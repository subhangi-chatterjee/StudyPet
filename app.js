const STORAGE_KEY = "study-pet-browser-state-v2";

const focusModes = [
  { id: "locked-in", label: "Locked In", minutes: 45, subtitle: "Longer focus windows for big momentum." },
  { id: "normal", label: "Normal", minutes: 25, subtitle: "Balanced quest sizes for a steady day." },
  { id: "distracted", label: "Distracted", minutes: 12, subtitle: "Quick wins when starting feels sticky." },
  { id: "exhausted", label: "Exhausted", minutes: 5, subtitle: "Tiny missions when you only have a little." }
];

const timerPresets = [10, 25, 45, 60];

const defaultAssignments = [];

const defaultState = {
  pet: {
    name: "Nib",
    xp: 0,
    level: 1,
    streakDays: 0,
    evolutionStage: 1,
    mood: "Curious"
  },
  focusMode: "normal",
  selectedAssignmentId: null,
  activeQuestKey: null,
  timer: {
    selectedMinutes: 10,
    remainingSeconds: 600,
    isRunning: false,
    completed: false
  },
  courses: [],
  assignments: defaultAssignments,
  subjectSkills: {},
  coachAlternateIndex: 0,
  lastCompletedQuestAt: null,
  statusLine: "Open app, see pet, pick quest, start tiny mission."
};

const state = loadState();
let timerIntervalId = null;

const elements = {
  headerLevel: document.getElementById("headerLevel"),
  headerXp: document.getElementById("headerXp"),
  headerStreak: document.getElementById("headerStreak"),
  openAssignmentModal: document.getElementById("openAssignmentModal"),
  assignmentModal: document.getElementById("assignmentModal"),
  closeAssignmentModal: document.getElementById("closeAssignmentModal"),
  cancelAssignmentModal: document.getElementById("cancelAssignmentModal"),
  assignmentForm: document.getElementById("assignmentForm"),
  assignmentCourse: document.getElementById("assignmentCourse"),
  addCourseButton: document.getElementById("addCourseButton"),
  focusModes: document.getElementById("focusModes"),
  petCamp: document.getElementById("petCamp"),
  petName: document.getElementById("petName"),
  petMood: document.getElementById("petMood"),
  petEvolution: document.getElementById("petEvolution"),
  assignmentCount: document.getElementById("assignmentCount"),
  petXp: document.getElementById("petXp"),
  petXpFill: document.getElementById("petXpFill"),
  petMessage: document.getElementById("petMessage"),
  petMouth: document.getElementById("petMouth"),
  renamePetButton: document.getElementById("renamePetButton"),
  questBoardLead: document.getElementById("questBoardLead"),
  questBoard: document.getElementById("questBoard"),
  coachRecommendation: document.getElementById("coachRecommendation"),
  startRecommendedQuest: document.getElementById("startRecommendedQuest"),
  makeQuestSmaller: document.getElementById("makeQuestSmaller"),
  pickSomethingElse: document.getElementById("pickSomethingElse"),
  activeQuestSummary: document.getElementById("activeQuestSummary"),
  timerStatus: document.getElementById("timerStatus"),
  timerCountdown: document.getElementById("timerCountdown"),
  timerCaption: document.getElementById("timerCaption"),
  startTimerButton: document.getElementById("startTimerButton"),
  completeTimerButton: document.getElementById("completeTimerButton"),
  celebrationBanner: document.getElementById("celebrationBanner"),
  skillList: document.getElementById("skillList")
};

seedAssignments();
ensureSelectedAssignment();
ensureActiveQuest();
syncTimerSelection();
wireEvents();
render();

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 11)}`;
}

function loadState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      pet: { ...structuredClone(defaultState.pet), ...(parsed.pet || {}) },
      timer: { ...structuredClone(defaultState.timer), ...(parsed.timer || {}) },
      courses: deriveCourseNames(parsed),
      subjectSkills: parsed.subjectSkills || structuredClone(defaultState.subjectSkills),
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : structuredClone(defaultAssignments)
    };
  } catch (_error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveAndRender() {
  ensureSelectedAssignment();
  ensureActiveQuest();
  saveState();
  render();
}

function wireEvents() {
  elements.openAssignmentModal.addEventListener("click", openModal);
  elements.closeAssignmentModal.addEventListener("click", closeModal);
  elements.cancelAssignmentModal.addEventListener("click", closeModal);
  elements.assignmentModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeModal === "true") {
      closeModal();
    }
  });

  elements.assignmentForm.addEventListener("submit", handleAddAssignment);
  elements.addCourseButton.addEventListener("click", handleAddCourse);
  elements.renamePetButton.addEventListener("click", renamePet);
  elements.startRecommendedQuest.addEventListener("click", () => {
    const recommended = recommendedQuest();
    if (!recommended) {
      return;
    }
    startQuest(recommended.key, true);
  });
  elements.makeQuestSmaller.addEventListener("click", shrinkRecommendedQuest);
  elements.pickSomethingElse.addEventListener("click", cycleRecommendation);
  elements.startTimerButton.addEventListener("click", toggleTimer);
  elements.completeTimerButton.addEventListener("click", celebrateSession);

  document.querySelectorAll(".timer-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const minutes = Number(chip.dataset.duration);
      state.timer.selectedMinutes = minutes;
      state.timer.remainingSeconds = minutes * 60;
      state.timer.isRunning = false;
      state.timer.completed = false;
      stopTimer();
      syncTimerSelection();
      saveAndRender();
    });
  });
}

function seedAssignments() {
  state.courses = deriveCourseNames(state);
  state.assignments = state.assignments.map((assignment) => {
    if (Array.isArray(assignment.quests) && assignment.quests.length > 0) {
      const cleanedQuests = assignment.quests
        .filter((quest) => !quest.done)
        .map((quest) => ({
          ...quest,
          progressPercent: Number.isFinite(quest.progressPercent) ? quest.progressPercent : 0,
          done: false
        }));
      const completedQuestCount = (assignment.completedQuestCount || 0) + assignment.quests.filter((quest) => quest.done).length;
      const totalQuestCount = Math.max(assignment.totalQuestCount || 0, cleanedQuests.length + completedQuestCount);
      const hydratedAssignment = {
        ...assignment,
        quests: cleanedQuests,
        completedQuestCount,
        totalQuestCount
      };
      updateAssignmentProgress(hydratedAssignment);
      return hydratedAssignment;
    }

    const quests = generateQuestChain(assignment, state.focusMode);
    const hydratedAssignment = {
      ...assignment,
      quests,
      completedQuestCount: assignment.completedQuestCount || 0,
      totalQuestCount: assignment.totalQuestCount || quests.length
    };
    updateAssignmentProgress(hydratedAssignment);
    return hydratedAssignment;
  });
}

function ensureSelectedAssignment() {
  if (state.selectedAssignmentId && state.assignments.some((assignment) => assignment.id === state.selectedAssignmentId)) {
    return;
  }
  state.selectedAssignmentId = state.assignments[0]?.id || null;
}

function ensureActiveQuest() {
  const questCards = allQuestCards();
  if (state.activeQuestKey && questCards.some((quest) => quest.key === state.activeQuestKey && !quest.done)) {
    return;
  }
  state.activeQuestKey = recommendedQuest()?.key || questCards.find((quest) => !quest.done)?.key || null;
}

function openModal() {
  renderCourseOptions();
  elements.assignmentModal.hidden = false;
}

function closeModal() {
  elements.assignmentModal.hidden = true;
}

function handleAddAssignment(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const assignment = {
    id: createId(),
    title: String(formData.get("title") || "").trim(),
    subject: String(formData.get("subject") || "").trim(),
    dueAt: String(formData.get("dueAt") || "").trim(),
    estimatedMinutes: Number(formData.get("estimatedMinutes") || 45),
    progressPercent: 0,
    quests: []
  };

  if (!assignment.title || !assignment.subject) {
    return;
  }

  ensureCourseExists(assignment.subject);
  assignment.quests = generateQuestChain(assignment, state.focusMode);
  state.assignments.unshift(assignment);
  state.selectedAssignmentId = assignment.id;
  state.activeQuestKey = `${assignment.id}:0`;
  state.pet.mood = "Curious";
  state.statusLine = "A new quest chain is ready at the board.";
  event.currentTarget.reset();
  document.getElementById("assignmentMinutes").value = 45;
  closeModal();
  saveAndRender();
}

function handleAddCourse() {
  const nextCourse = window.prompt("Add a course name", "");
  if (!nextCourse) {
    return;
  }
  const normalizedCourse = normalizeCourseName(nextCourse);
  if (!normalizedCourse) {
    return;
  }
  ensureCourseExists(normalizedCourse);
  elements.assignmentCourse.value = normalizedCourse;
  state.statusLine = `${normalizedCourse} added to your course list.`;
  saveAndRender();
  renderCourseOptions();
}

function renderCourseOptions() {
  const options = state.courses
    .map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`)
    .join("");

  elements.assignmentCourse.innerHTML = `
    <option value="" disabled ${elements.assignmentCourse.value ? "" : "selected"}>Select a course</option>
    ${options}
  `;
}

function renamePet() {
  const nextName = window.prompt("What should your pet be called?", state.pet.name);
  if (!nextName) {
    return;
  }
  state.pet.name = nextName.trim().slice(0, 20) || state.pet.name;
  state.statusLine = `${state.pet.name} loves the new name.`;
  saveAndRender();
}

function render() {
  const nextLevelXp = state.pet.level * 50;
  const completedCount = completedQuestCount();

  elements.headerLevel.textContent = String(state.pet.level);
  elements.headerXp.textContent = `${state.pet.xp} / ${nextLevelXp}`;
  elements.headerStreak.textContent = `${state.pet.streakDays} days`;

  renderFocusModes();
  renderPet();
  renderQuestBoard();
  renderCoach();
  renderTimer();
  renderSkills();
  syncTimerSelection();

  if (completedCount > 0 && state.pet.mood === "Curious") {
    state.pet.mood = "Proud";
  }
}

function renderFocusModes() {
  elements.focusModes.innerHTML = focusModes
    .map((mode) => {
      const active = mode.id === state.focusMode ? "active" : "";
      return `
        <button class="focus-chip ${active}" type="button" data-focus-id="${mode.id}">
          ${mode.label}
        </button>
      `;
    })
    .join("");

  elements.focusModes.querySelectorAll("[data-focus-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusMode = button.dataset.focusId;
      state.coachAlternateIndex = 0;
      resizeQuestChainsForMode();
      state.pet.mood = petMoodFromProgress();
      state.statusLine = `${labelForFocusMode(state.focusMode)} mode picked. Small missions updated.`;
      saveAndRender();
    });
  });
}

function resizeQuestChainsForMode() {
  state.assignments = state.assignments.map((assignment) => {
    const currentQuests = Array.isArray(assignment.quests) ? assignment.quests : [];
    const regeneratedQuests = generateQuestChain(assignment, state.focusMode).map((quest, index) => ({
      ...quest,
      progressPercent: currentQuests[index]?.progressPercent || 0,
      done: false
    }));
    const updatedAssignment = {
      ...assignment,
      quests: regeneratedQuests,
      totalQuestCount: Math.max(assignment.totalQuestCount || 0, regeneratedQuests.length + (assignment.completedQuestCount || 0))
    };
    updateAssignmentProgress(updatedAssignment);
    return updatedAssignment;
  });
}

function renderPet() {
  const nextLevelXp = state.pet.level * 50;
  const moodClass = `mood-${petMoodClass()}`;
  elements.petCamp.className = `pet-camp ${moodClass}`;
  elements.petName.textContent = state.pet.name;
  elements.petMood.textContent = petMoodLabel();
  elements.petEvolution.textContent = `Stage ${state.pet.evolutionStage}`;
  elements.assignmentCount.textContent = String(state.assignments.length);
  elements.petXp.textContent = `${state.pet.xp} / ${nextLevelXp} XP`;
  elements.petXpFill.style.width = `${Math.min(100, (state.pet.xp / nextLevelXp) * 100)}%`;
  elements.petMessage.textContent = petMessage();
  elements.petMouth.setAttribute("d", mouthPath());
}

function renderQuestBoard() {
  const quests = allQuestCards();
  const recommended = recommendedQuest();
  const openQuests = quests.filter((quest) => !quest.done);

  elements.questBoardLead.innerHTML = recommended
    ? `
      <strong>${state.pet.name} marked a starting point for you.</strong>
      <p>${recommended.title} is glowing because it fits your current brain mode and is small enough to begin.</p>
    `
    : `
      <strong>Your quest board is clear.</strong>
      <p>Add a new assignment to spin up another chain of study missions.</p>
    `;

  if (quests.length === 0) {
    elements.questBoard.innerHTML = `<div class="empty-state">No quests yet. Open the add assignment modal and create your first mission chain.</div>`;
    return;
  }

  elements.questBoard.innerHTML = quests
    .map((quest) => {
      const recommendedClass = recommended && recommended.key === quest.key ? "recommended" : "";
      const activeClass = state.activeQuestKey === quest.key ? "active" : "";
      const completedClass = quest.done ? "completed" : "";

      return `
        <article class="quest-card ${recommendedClass} ${activeClass} ${completedClass}">
          <div class="quest-card-top">
            <div class="quest-title-block">
              <h3>${quest.title}</h3>
              <p>${quest.subject}</p>
            </div>
            <div class="badge-row">
              ${recommended && recommended.key === quest.key ? `<span class="badge">Recommended</span>` : ""}
              <span class="badge quest-type">${quest.questType}</span>
            </div>
          </div>

          <div class="quest-meta">
            <div class="quest-stats">
              <span class="badge">${quest.estimatedMinutes} min</span>
              <span class="badge">+${quest.xpReward} XP</span>
              <span class="badge">${quest.sizeLabel}</span>
              <span class="badge ${quest.urgencyClass}">${quest.urgencyLabel}</span>
            </div>
            ${
              quest.done
                ? `<span class="badge">Completed</span>`
                : `<button class="quest-action" type="button" data-start-quest="${quest.key}">${state.activeQuestKey === quest.key ? "Quest Active" : "Start Quest"}</button>`
            }
          </div>
          ${
            quest.done
              ? ""
              : `
                <div class="quest-progress-block">
                  <label class="quest-progress-label" for="progress-${quest.key}">
                    Work done: <strong>${quest.progressPercent}%</strong>
                  </label>
                  <input
                    id="progress-${quest.key}"
                    class="quest-progress-slider"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value="${quest.progressPercent}"
                    data-progress-quest="${quest.key}"
                  />
                  <div class="quest-secondary-actions">
                    <button class="ghost-button" type="button" data-remove-quest="${quest.key}">Remove Quest</button>
                    <button class="ghost-button" type="button" data-finish-quest="${quest.key}">Finish Quest</button>
                  </div>
                </div>
              `
          }
        </article>
      `;
    })
    .join("");

  elements.questBoard.querySelectorAll("[data-start-quest]").forEach((button) => {
    button.addEventListener("click", () => {
      startQuest(button.dataset.startQuest, true);
    });
  });

  elements.questBoard.querySelectorAll("[data-progress-quest]").forEach((slider) => {
    slider.addEventListener("input", () => {
      updateQuestProgress(slider.dataset.progressQuest, Number(slider.value));
    });
  });

  elements.questBoard.querySelectorAll("[data-finish-quest]").forEach((button) => {
    button.addEventListener("click", () => {
      finishQuestByKey(button.dataset.finishQuest);
    });
  });

  elements.questBoard.querySelectorAll("[data-remove-quest]").forEach((button) => {
    button.addEventListener("click", () => {
      removeQuestByKey(button.dataset.removeQuest);
    });
  });
}

function renderCoach() {
  const recommendation = recommendedQuest();
  if (!recommendation) {
    elements.coachRecommendation.innerHTML = `<div class="empty-state">No quests to recommend yet. Add an assignment to wake up the quest board.</div>`;
    return;
  }

  const reasons = recommendation.reasons.map((reason) => `<li>${reason}</li>`).join("");
  elements.coachRecommendation.innerHTML = `
    <div class="coach-quest-header">
      <div>
        <p class="stat-label">${state.pet.name} recommends</p>
        <strong>${recommendation.title}</strong>
        <p>${recommendation.subject} · ${recommendation.estimatedMinutes} min · +${recommendation.xpReward} XP</p>
      </div>
      <span class="badge quest-type">${recommendation.questType}</span>
    </div>
    <ul class="coach-reasons">
      ${reasons}
    </ul>
  `;
}

function renderTimer() {
  const activeQuest = questByKey(state.activeQuestKey);
  const label = activeQuest ? `${activeQuest.title} · ${activeQuest.subject}` : "Pick a quest to start a tiny mission.";

  elements.activeQuestSummary.innerHTML = activeQuest
    ? `<strong>Active quest</strong><p>${label}</p>`
    : `<strong>No active quest yet</strong><p>Choose any quest card or use the recommendation button.</p>`;

  elements.timerStatus.textContent = state.timer.completed ? "Celebration ready" : state.timer.isRunning ? "Focus session live" : "Not running";
  elements.timerCountdown.textContent = formatTimer(state.timer.remainingSeconds);
  elements.timerCaption.textContent = timerCaption();
  elements.startTimerButton.textContent = state.timer.isRunning ? "Pause focus session" : "Start focus session";
  elements.celebrationBanner.hidden = !state.timer.completed;
}

function renderSkills() {
  const entries = state.courses.map((course) => [course, state.subjectSkills[course] || { level: 1, xp: 0 }]);
  if (!entries.length) {
    elements.skillList.innerHTML = `<div class="empty-state">Add a course to start building your character stats.</div>`;
    return;
  }

  elements.skillList.innerHTML = entries
    .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)
    .map(([subject, skill]) => {
      const nextSkillXp = skill.level * 40;
      return `
        <article class="skill-card">
          <div class="skill-header">
            <div>
              <h3>${subject}</h3>
              <p>Level ${skill.level}</p>
            </div>
            <div class="skill-actions">
              <span class="badge">${skill.xp} / ${nextSkillXp}</span>
              <button class="ghost-button skill-remove-button" type="button" data-remove-course="${escapeHtml(subject)}">Remove</button>
            </div>
          </div>
          <div class="skill-meta">
            <div class="skill-track">
              <div class="skill-fill" style="width: ${Math.min(100, (skill.xp / nextSkillXp) * 100)}%"></div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  elements.skillList.querySelectorAll("[data-remove-course]").forEach((button) => {
    button.addEventListener("click", () => {
      removeCourse(button.dataset.removeCourse);
    });
  });
}

function startQuest(questKey, autoStartTimer) {
  state.activeQuestKey = questKey;
  const quest = questByKey(questKey);
  if (quest) {
    state.selectedAssignmentId = quest.assignmentId;
    state.timer.completed = false;
    state.timer.remainingSeconds = state.timer.selectedMinutes * 60;
    state.statusLine = `${quest.title} is now your tiny mission.`;
  }
  saveAndRender();
  if (autoStartTimer) {
    startTimer();
  }
}

function shrinkRecommendedQuest() {
  const recommendation = recommendedQuest();
  if (!recommendation) {
    return;
  }
  const assignment = assignmentById(recommendation.assignmentId);
  if (!assignment) {
    return;
  }

  const smallerMode = smallerFocusMode(state.focusMode);
  const regenerated = generateQuestChain(assignment, smallerMode);
  assignment.quests = regenerated.map((quest) => ({ ...quest, progressPercent: 0 }));
  state.focusMode = smallerMode;
  state.coachAlternateIndex = 0;
  state.activeQuestKey = `${assignment.id}:0`;
  assignment.completedQuestCount = 0;
  assignment.totalQuestCount = regenerated.length;
  updateAssignmentProgress(assignment);
  state.statusLine = `Made ${assignment.title} smaller for ${labelForFocusMode(smallerMode)} mode.`;
  saveAndRender();
}

function cycleRecommendation() {
  const openQuests = allQuestCards().filter((quest) => !quest.done);
  if (openQuests.length < 2) {
    return;
  }
  state.coachAlternateIndex = (state.coachAlternateIndex + 1) % openQuests.length;
  state.statusLine = "Showing another good starting option.";
  saveAndRender();
}

function toggleTimer() {
  if (state.timer.isRunning) {
    stopTimer();
    state.timer.isRunning = false;
    state.statusLine = "Focus session paused.";
    saveAndRender();
    return;
  }
  startTimer();
}

function startTimer() {
  if (!state.activeQuestKey) {
    const recommendation = recommendedQuest();
    if (!recommendation) {
      return;
    }
    state.activeQuestKey = recommendation.key;
  }

  stopTimer();
  state.timer.isRunning = true;
  state.timer.completed = false;
  timerIntervalId = window.setInterval(() => {
    if (!state.timer.isRunning) {
      return;
    }
    if (state.timer.remainingSeconds > 0) {
      state.timer.remainingSeconds -= 1;
      renderTimer();
      saveState();
      return;
    }
    stopTimer();
    state.timer.isRunning = false;
    state.timer.completed = true;
    state.pet.mood = "Proud";
    state.statusLine = `${state.pet.name} is cheering. Your focus session is complete.`;
    saveAndRender();
  }, 1000);
  state.statusLine = "Focus session started.";
  saveAndRender();
}

function stopTimer() {
  if (timerIntervalId) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function celebrateSession() {
  if (!state.timer.completed) {
    return;
  }
  const quest = questByKey(state.activeQuestKey);
  if (quest && !quest.done) {
    finishQuestByKey(quest.key);
    state.statusLine = `${state.pet.name} celebrated your win. Quest marked complete.`;
  }
  state.timer.completed = false;
  state.timer.remainingSeconds = state.timer.selectedMinutes * 60;
  saveAndRender();
}

function finishQuestByKey(questKey) {
  const quest = questByKey(questKey);
  if (!quest) {
    return;
  }
  completeQuest(quest.assignmentId, quest.questIndex);
  saveAndRender();
}

function removeQuestByKey(questKey) {
  const quest = questByKey(questKey);
  if (!quest) {
    return;
  }

  const shouldRemove = window.confirm(`Remove "${quest.title}" from the quest board? Use this if the assignment was cancelled or no longer matters.`);
  if (!shouldRemove) {
    return;
  }

  const assignment = assignmentById(quest.assignmentId);
  if (!assignment) {
    return;
  }

  assignment.quests.splice(quest.questIndex, 1);
  assignment.totalQuestCount = Math.max(assignment.completedQuestCount || 0, assignment.quests.length + (assignment.completedQuestCount || 0));
  updateAssignmentProgress(assignment);
  state.statusLine = `"${quest.title}" was removed from the quest board.`;
  saveAndRender();
}

function completeQuest(assignmentId, questIndex) {
  const assignment = assignmentById(assignmentId);
  if (!assignment) {
    return;
  }

  const quest = assignment.quests[questIndex];
  if (!quest) {
    return;
  }

  addXp(quest.xpReward);
  addSubjectXp(normalizedSubject(assignment), quest.xpReward);
  assignment.completedQuestCount = (assignment.completedQuestCount || 0) + 1;
  assignment.totalQuestCount = Math.max(assignment.totalQuestCount || 0, assignment.quests.length);
  assignment.quests.splice(questIndex, 1);
  updateAssignmentProgress(assignment);
  updateDailyStreak();
  state.pet.mood = "Proud";
  if (assignment.quests.length === 0) {
    state.statusLine = `${assignment.title} is complete.`;
  } else {
    state.statusLine = `${quest.title} finished and cleared from the board.`;
  }
}

function addXp(amount) {
  state.pet.xp += amount;
  while (state.pet.xp >= state.pet.level * 50) {
    state.pet.xp -= state.pet.level * 50;
    state.pet.level += 1;
    if ([3, 6, 10].includes(state.pet.level)) {
      state.pet.evolutionStage += 1;
    }
  }
}

function updateDailyStreak() {
  const now = new Date();
  const todayStamp = pacificDayStamp(now);
  const lastCompletionStamp = state.lastCompletedQuestAt ? pacificDayStamp(new Date(state.lastCompletedQuestAt)) : null;

  if (!lastCompletionStamp) {
    state.pet.streakDays = 1;
    state.lastCompletedQuestAt = now.toISOString();
    return;
  }

  if (lastCompletionStamp === todayStamp) {
    state.lastCompletedQuestAt = now.toISOString();
    return;
  }

  const dayGap = dayDifferenceInPacific(lastCompletionStamp, todayStamp);
  if (dayGap === 1) {
    state.pet.streakDays += 1;
  } else {
    state.pet.streakDays = 1;
  }
  state.lastCompletedQuestAt = now.toISOString();
}

function pacificDayStamp(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function dayDifferenceInPacific(fromDayStamp, toDayStamp) {
  const fromDate = new Date(`${fromDayStamp}T12:00:00Z`);
  const toDate = new Date(`${toDayStamp}T12:00:00Z`);
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

function addSubjectXp(subject, amount) {
  ensureCourseExists(subject);
  if (!state.subjectSkills[subject]) {
    state.subjectSkills[subject] = { level: 1, xp: 0 };
  }
  const skill = state.subjectSkills[subject];
  skill.xp += amount;
  while (skill.xp >= skill.level * 40) {
    skill.xp -= skill.level * 40;
    skill.level += 1;
  }
}

function generateQuestChain(assignment, focusMode) {
  const subject = normalizedSubject(assignment);
  const preferred = preferredMinutes(focusMode);
  const quests = [];

  if (subject === "History" || subject === "Writing") {
    quests.push(createQuest("Pick the angle", "Choose the topic or argument you want to make.", Math.min(preferred, 10)));
    quests.push(createQuest("Collect evidence", "Find facts, quotes, or sources you can use.", Math.max(10, preferred)));
    quests.push(createQuest("Build the outline", "List the intro, key points, and closing idea.", Math.max(10, preferred)));
    quests.push(createQuest("Write one section", "Draft the easiest section first to build momentum.", Math.max(15, preferred)));
    if (assignment.estimatedMinutes > 90) {
      quests.push(createQuest("Boss draft push", "Finish the rough draft while the structure is fresh.", Math.max(45, preferred + 15)));
    }
  } else if (subject === "Math") {
    quests.push(createQuest("Set up your space", "Open the worksheet and mark the first doable problem.", Math.min(preferred, 5)));
    quests.push(createQuest("Problems 1-5", "Knock out the warm-up chunk first.", Math.max(10, preferred)));
    quests.push(createQuest("Check the tricky step", "Review one mistake and fix it carefully.", Math.min(15, Math.max(preferred, 10))));
    if (assignment.estimatedMinutes > 25) {
      quests.push(createQuest("Finish the last chunk", "Wrap up the remaining problems.", Math.max(20, preferred)));
    }
  } else if (subject === "Biology" || subject === "Reading" || subject === "Spanish") {
    quests.push(createQuest("Preview the material", "Scan headings, bold terms, and key concepts before diving in.", Math.min(preferred, 5)));
    quests.push(createQuest("Read one chunk", "Work through one section and mark the ideas that matter.", Math.max(10, preferred)));
    quests.push(createQuest("Write quick notes", "Capture 3 to 5 takeaways in your own words.", Math.min(15, Math.max(preferred, 10))));
    if (assignment.estimatedMinutes > 35) {
      quests.push(createQuest("Second pass", "Do one more chunk while the context is warm.", Math.max(20, preferred)));
    }
  } else {
    quests.push(createQuest("Define done", "Write what success looks like in one short sentence.", Math.min(preferred, 5)));
    quests.push(createQuest("Start the smallest step", "Do the tiniest useful action that gets this moving.", Math.max(10, preferred)));
    quests.push(createQuest("Make progress visible", "Check off what is finished and note what remains.", Math.min(15, Math.max(preferred, 10))));
    if (assignment.estimatedMinutes > 45) {
      quests.push(createQuest("Boss momentum block", "Finish another meaningful chunk while you are already engaged.", Math.max(45, preferred + 10)));
    }
  }

  return quests;
}

function createQuest(title, description, estimatedMinutes) {
  return {
    title,
    description,
    estimatedMinutes,
    xpReward: xpForMinutes(estimatedMinutes),
    progressPercent: 0,
    done: false
  };
}

function allQuestCards() {
  return state.assignments.flatMap((assignment) => {
    return assignment.quests.map((quest, index) => {
      const dueInfo = dueUrgency(assignment.dueAt);
      const questType = classifyQuestType(quest.estimatedMinutes);
      return {
        ...quest,
        key: `${assignment.id}:${index}`,
        assignmentId: assignment.id,
        questIndex: index,
        assignmentTitle: assignment.title,
        subject: normalizedSubject(assignment),
        urgencyLabel: dueInfo.label,
        urgencyClass: dueInfo.className,
        daysUntilDue: dueInfo.daysUntil,
        questType,
        sizeLabel: focusSizeLabel(quest.estimatedMinutes),
        progressPercent: quest.progressPercent || 0
      };
    });
  });
}

function recommendedQuest() {
  const openQuests = allQuestCards().filter((quest) => !quest.done);
  if (openQuests.length === 0) {
    return null;
  }

  const ranked = openQuests
    .map((quest) => ({
      ...quest,
      score: recommendationScore(quest),
      reasons: recommendationReasons(quest)
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[state.coachAlternateIndex % ranked.length];
}

function recommendationScore(quest) {
  const urgencyBoost = quest.daysUntilDue === null ? 8 : Math.max(0, 55 - quest.daysUntilDue * 12);
  const modePreference = modePreferenceBoost(quest);
  const sizeFit = quest.estimatedMinutes <= preferredMinutes(state.focusMode) ? 18 : Math.max(2, 12 - Math.abs(quest.estimatedMinutes - preferredMinutes(state.focusMode)));
  const progressBonus = quest.progressPercent >= 50 ? 10 : quest.progressPercent >= 20 ? 4 : 0;
  return urgencyBoost + sizeFit + modePreference + progressBonus;
}

function recommendationReasons(quest) {
  const reasons = [];
  if (quest.daysUntilDue !== null && quest.daysUntilDue <= 1) {
    reasons.push("Due soon");
  } else {
    reasons.push(`Due timing: ${quest.urgencyLabel.toLowerCase()}`);
  }

  if (quest.estimatedMinutes <= preferredMinutes(state.focusMode)) {
    reasons.push(`Matches your current brain mode: ${labelForFocusMode(state.focusMode)}`);
  } else {
    reasons.push("Still small enough to start without a big ramp-up");
  }

  if (quest.progressPercent >= 50) {
    reasons.push("You are already halfway through this one");
  } else if (quest.questType === "Micro Quest") {
    reasons.push("Small enough to get a quick win");
  } else if (quest.questType === "Boss Quest") {
    reasons.push("A bigger push if you want one meaningful block");
  } else {
    reasons.push("Good balance between momentum and progress");
  }
  return reasons.slice(0, 3);
}

function recommendationByKey(key) {
  return allQuestCards().find((quest) => quest.key === key) || null;
}

function questByKey(key) {
  return recommendationByKey(key);
}

function assignmentById(id) {
  return state.assignments.find((assignment) => assignment.id === id) || null;
}

function ensureCourseExists(courseName) {
  const normalizedCourse = normalizeCourseName(courseName);
  if (!normalizedCourse) {
    return;
  }
  if (!state.courses.includes(normalizedCourse)) {
    state.courses.push(normalizedCourse);
    state.courses.sort((a, b) => a.localeCompare(b));
  }
  if (!state.subjectSkills[normalizedCourse]) {
    state.subjectSkills[normalizedCourse] = { level: 1, xp: 0 };
  }
}

function removeCourse(courseName) {
  const normalizedCourse = normalizeCourseName(courseName);
  if (!normalizedCourse) {
    return;
  }

  const relatedAssignments = state.assignments.filter((assignment) => normalizeCourseName(assignment.subject) === normalizedCourse);
  const assignmentCount = relatedAssignments.length;
  const warning =
    assignmentCount > 0
      ? `Remove ${normalizedCourse}? This will also remove ${assignmentCount} assignment${assignmentCount === 1 ? "" : "s"} linked to this course.`
      : `Remove ${normalizedCourse} from your course list?`;

  if (!window.confirm(warning)) {
    return;
  }

  state.courses = state.courses.filter((course) => course !== normalizedCourse);
  delete state.subjectSkills[normalizedCourse];
  if (assignmentCount > 0) {
    const removedIds = new Set(relatedAssignments.map((assignment) => assignment.id));
    state.assignments = state.assignments.filter((assignment) => !removedIds.has(assignment.id));
    const activeQuest = questByKey(state.activeQuestKey);
    if (activeQuest && removedIds.has(activeQuest.assignmentId)) {
      state.activeQuestKey = null;
    }
  }

  state.statusLine = assignmentCount > 0
    ? `${normalizedCourse} and its assignments were removed.`
    : `${normalizedCourse} was removed from your course list.`;
  saveAndRender();
}

function deriveCourseNames(sourceState) {
  const courseSet = new Set();
  const assignments = Array.isArray(sourceState.assignments) ? sourceState.assignments : defaultAssignments;
  assignments.forEach((assignment) => {
    const course = normalizeCourseName(assignment.subject);
    if (course) {
      courseSet.add(course);
    }
  });

  const subjectSkills = sourceState.subjectSkills || {};
  Object.keys(subjectSkills).forEach((course) => {
    const normalizedCourse = normalizeCourseName(course);
    if (normalizedCourse) {
      courseSet.add(normalizedCourse);
    }
  });

  if (Array.isArray(sourceState.courses)) {
    sourceState.courses.forEach((course) => {
      const normalizedCourse = normalizeCourseName(course);
      if (normalizedCourse) {
        courseSet.add(normalizedCourse);
      }
    });
  }

  return [...courseSet].sort((a, b) => a.localeCompare(b));
}

function normalizeCourseName(courseName) {
  return String(courseName || "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateQuestProgress(questKey, nextProgressPercent) {
  const quest = questByKey(questKey);
  if (!quest) {
    return;
  }
  const assignment = assignmentById(quest.assignmentId);
  if (!assignment) {
    return;
  }
  assignment.quests[quest.questIndex].progressPercent = Math.max(0, Math.min(100, nextProgressPercent));
  updateAssignmentProgress(assignment);
  state.activeQuestKey = questKey;
  state.statusLine = `${assignment.quests[quest.questIndex].title} progress updated to ${assignment.quests[quest.questIndex].progressPercent}%.`;
  saveAndRender();
}

function updateAssignmentProgress(assignment) {
  const totalQuestCount = Math.max(assignment.totalQuestCount || 0, assignment.quests.length + (assignment.completedQuestCount || 0));
  assignment.totalQuestCount = totalQuestCount;
  const completedContribution = (assignment.completedQuestCount || 0) * 100;
  const inProgressContribution = assignment.quests.reduce((sum, quest) => sum + (quest.progressPercent || 0), 0);
  assignment.progressPercent = totalQuestCount ? Math.round((completedContribution + inProgressContribution) / totalQuestCount) : 0;
}

function modePreferenceBoost(quest) {
  if (state.focusMode === "exhausted") {
    return quest.questType === "Micro Quest" ? 24 : quest.questType === "Focus Quest" ? 4 : -16;
  }
  if (state.focusMode === "distracted") {
    return quest.questType === "Micro Quest" ? 18 : quest.questType === "Focus Quest" ? 7 : -10;
  }
  if (state.focusMode === "locked-in") {
    return quest.questType === "Boss Quest" ? 16 : quest.questType === "Focus Quest" ? 10 : -2;
  }
  return quest.questType === "Focus Quest" ? 12 : quest.questType === "Micro Quest" ? 8 : 4;
}

function normalizeText(text) {
  return String(text || "").toLowerCase();
}

function normalizedSubject(assignment) {
  if (assignment.subject) {
    return assignment.subject;
  }

  const title = normalizeText(assignment.title);
  if (title.includes("essay") || title.includes("write")) {
    return "Writing";
  }
  if (title.includes("math") || title.includes("worksheet")) {
    return "Math";
  }
  if (title.includes("bio")) {
    return "Biology";
  }
  if (title.includes("spanish")) {
    return "Spanish";
  }
  if (title.includes("read")) {
    return "Reading";
  }
  return "General";
}

function preferredMinutes(modeId) {
  return focusModes.find((mode) => mode.id === modeId)?.minutes || 25;
}

function labelForFocusMode(modeId) {
  return focusModes.find((mode) => mode.id === modeId)?.label || "Normal";
}

function smallerFocusMode(modeId) {
  if (modeId === "locked-in") {
    return "normal";
  }
  if (modeId === "normal") {
    return "distracted";
  }
  return "exhausted";
}

function xpForMinutes(minutes) {
  if (minutes <= 5) {
    return 8;
  }
  if (minutes <= 12) {
    return 15;
  }
  if (minutes <= 30) {
    return 20;
  }
  return 28;
}

function classifyQuestType(minutes) {
  if (minutes <= 15) {
    return "Micro Quest";
  }
  if (minutes <= 45) {
    return "Focus Quest";
  }
  return "Boss Quest";
}

function focusSizeLabel(minutes) {
  if (minutes <= 10) {
    return "Tiny step";
  }
  if (minutes <= 25) {
    return "Starter-sized";
  }
  if (minutes <= 45) {
    return "Deep focus";
  }
  return "Big push";
}

function dueUrgency(dateString) {
  if (!dateString) {
    return { label: "No due date", className: "urgency-low", daysUntil: null };
  }
  const due = new Date(`${dateString}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (daysUntil <= 0) {
    return { label: daysUntil === 0 ? "Due today" : `Late by ${Math.abs(daysUntil)} days`, className: "urgency-high", daysUntil };
  }
  if (daysUntil === 1) {
    return { label: "Due tomorrow", className: "urgency-high", daysUntil };
  }
  if (daysUntil <= 3) {
    return { label: `Due in ${daysUntil} days`, className: "urgency-high", daysUntil };
  }
  return { label: `Due in ${daysUntil} days`, className: "urgency-low", daysUntil };
}

function completedQuestCount() {
  return allQuestCards().filter((quest) => quest.done).length;
}

function petMoodFromProgress() {
  if (state.focusMode === "exhausted") {
    return "Cozy";
  }
  if (state.focusMode === "locked-in") {
    return "Focused";
  }
  if (completedQuestCount() > 0) {
    return "Proud";
  }
  return "Curious";
}

function petMoodLabel() {
  return petMoodFromProgress();
}

function petMoodClass() {
  return normalizeText(petMoodFromProgress()).replace(/\s+/g, "-");
}

function petMessage() {
  const recommendation = recommendedQuest();
  if (!recommendation) {
    return `${state.pet.name} is resting by the campfire. Add one assignment to wake up a new quest chain.`;
  }
  if (state.focusMode === "exhausted") {
    return `${state.pet.name} looks cozy today. One tiny quest is enough to help ${state.pet.name} feel braver.`;
  }
  if (state.focusMode === "distracted") {
    return `${state.pet.name} is gently nudging you toward small wins. Start with ${recommendation.estimatedMinutes} quiet minutes.`;
  }
  if (completedQuestCount() > 0) {
    return `${state.pet.name} is proud of your progress. One more quest will keep the campfire bright.`;
  }
  return `${state.pet.name} is curious today. Complete one quest to help ${state.pet.name} grow.`;
}

function mouthPath() {
  const mood = petMoodFromProgress();
  if (mood === "Cozy") {
    return "M96 136C102 132 118 132 124 136";
  }
  if (mood === "Focused") {
    return "M96 132C104 135 116 135 124 132";
  }
  if (mood === "Proud") {
    return "M95 131C101 142 119 142 125 131";
  }
  return "M96 132C102 140 118 140 124 132";
}

function syncTimerSelection() {
  document.querySelectorAll(".timer-chip").forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.duration) === state.timer.selectedMinutes);
  });
}

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function timerCaption() {
  if (state.timer.completed) {
    return "Session complete. Time for a little celebration.";
  }
  if (state.timer.isRunning) {
    return "Stay with one tiny mission until the bell.";
  }
  const activeQuest = questByKey(state.activeQuestKey);
  if (activeQuest) {
    return `${activeQuest.questType} timer ready for ${activeQuest.title}.`;
  }
  return "Pick a quest and choose how long you want to focus.";
}
