const STORAGE_KEY = "study-pet-browser-state-v1";

const focusModes = [
  {
    id: "locked-in",
    label: "Locked In",
    minutes: 35,
    subtitle: "Longer missions when your brain is humming."
  },
  {
    id: "normal",
    label: "Normal",
    minutes: 25,
    subtitle: "Balanced quest sizes for a regular day."
  },
  {
    id: "distracted",
    label: "Distracted",
    minutes: 12,
    subtitle: "Quick wins to reduce friction and overwhelm."
  },
  {
    id: "exhausted",
    label: "Exhausted",
    minutes: 5,
    subtitle: "Micro-quests for the tiniest possible start."
  }
];

const defaultAssignments = [
  {
    id: crypto.randomUUID(),
    title: "History essay due Friday",
    subject: "History",
    dueAt: "2026-06-26",
    estimatedMinutes: 120,
    progressPercent: 0,
    quests: []
  },
  {
    id: crypto.randomUUID(),
    title: "Math worksheet chapter 8",
    subject: "Math",
    dueAt: "2026-06-23",
    estimatedMinutes: 30,
    progressPercent: 0,
    quests: []
  }
];

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
  statusLine: "Offline study pet ready",
  assignments: defaultAssignments,
  subjectSkills: {}
};

const state = loadState();

const elements = {
  focusModes: document.getElementById("focusModes"),
  focusBadge: document.getElementById("focusBadge"),
  petAvatar: document.getElementById("petAvatar"),
  petName: document.getElementById("petName"),
  petMood: document.getElementById("petMood"),
  petEvolution: document.getElementById("petEvolution"),
  petLevel: document.getElementById("petLevel"),
  petXp: document.getElementById("petXp"),
  petStreak: document.getElementById("petStreak"),
  assignmentCount: document.getElementById("assignmentCount"),
  recommendationCard: document.getElementById("recommendationCard"),
  assignmentList: document.getElementById("assignmentList"),
  selectedAssignmentTitle: document.getElementById("selectedAssignmentTitle"),
  selectedAssignmentMeta: document.getElementById("selectedAssignmentMeta"),
  questList: document.getElementById("questList"),
  skillList: document.getElementById("skillList"),
  assignmentForm: document.getElementById("assignmentForm"),
  rebuildSelected: document.getElementById("rebuildSelected"),
  completeNextQuest: document.getElementById("completeNextQuest"),
  refreshRecommendation: document.getElementById("refreshRecommendation")
};

ensureSeededQuests();
ensureSelectedAssignment();
wireEvents();
render();

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
      subjectSkills: parsed.subjectSkills || {},
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : structuredClone(defaultAssignments)
    };
  } catch (_error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function wireEvents() {
  elements.assignmentForm.addEventListener("submit", handleAddAssignment);
  elements.rebuildSelected.addEventListener("click", () => {
    const assignment = getSelectedAssignment();
    if (!assignment) {
      return;
    }
    assignment.quests = generateOfflineQuests(assignment, state.focusMode);
    assignment.progressPercent = 0;
    state.statusLine = "Rebuilt quest chain";
    saveAndRender();
  });

  elements.completeNextQuest.addEventListener("click", () => {
    const assignment = getSelectedAssignment();
    if (!assignment) {
      return;
    }
    markNextQuestDone(assignment);
  });

  elements.refreshRecommendation.addEventListener("click", () => {
    state.statusLine = "Refreshed recommendation";
    saveAndRender();
  });
}

function ensureSeededQuests() {
  state.assignments = state.assignments.map((assignment) => {
    if (Array.isArray(assignment.quests) && assignment.quests.length > 0) {
      return assignment;
    }
    return {
      ...assignment,
      progressPercent: assignment.progressPercent || 0,
      quests: generateOfflineQuests(assignment, state.focusMode)
    };
  });
}

function ensureSelectedAssignment() {
  if (state.selectedAssignmentId && state.assignments.some((assignment) => assignment.id === state.selectedAssignmentId)) {
    return;
  }
  state.selectedAssignmentId = state.assignments[0]?.id || null;
}

function saveAndRender() {
  ensureSelectedAssignment();
  saveState();
  render();
}

function handleAddAssignment(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const assignment = {
    id: crypto.randomUUID(),
    title: String(formData.get("title") || "").trim(),
    subject: String(formData.get("subject") || "").trim(),
    dueAt: String(formData.get("dueAt") || "").trim(),
    estimatedMinutes: Number(formData.get("estimatedMinutes") || 30),
    progressPercent: 0,
    quests: []
  };

  if (!assignment.title) {
    return;
  }

  assignment.quests = generateOfflineQuests(assignment, state.focusMode);
  state.assignments.unshift(assignment);
  state.selectedAssignmentId = assignment.id;
  state.pet.mood = "Focused";
  state.statusLine = "Added new assignment";
  event.currentTarget.reset();
  document.getElementById("assignmentMinutes").value = 30;
  saveAndRender();
}

function render() {
  renderFocusModes();
  renderPet();
  renderRecommendation();
  renderAssignments();
  renderSelectedAssignment();
  renderSkills();
}

function renderFocusModes() {
  elements.focusBadge.textContent = labelForFocusMode(state.focusMode);
  elements.focusModes.innerHTML = focusModes
    .map((mode) => {
      const activeClass = mode.id === state.focusMode ? "active" : "";
      return `
        <button class="focus-card ${activeClass}" type="button" data-focus-id="${mode.id}">
          <strong>${mode.label}</strong>
          <span>${mode.subtitle}</span>
        </button>
      `;
    })
    .join("");

  elements.focusModes.querySelectorAll("[data-focus-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusMode = button.dataset.focusId;
      state.pet.mood = focusMood(state.focusMode);
      state.statusLine = "Adjusted brain mode";
      saveAndRender();
    });
  });
}

function renderPet() {
  const nextLevelXp = state.pet.level * 50;
  elements.petAvatar.textContent = avatarForPet(state.pet.evolutionStage, state.pet.mood);
  elements.petName.textContent = state.pet.name;
  elements.petMood.textContent = state.pet.mood;
  elements.petEvolution.textContent = `Stage ${state.pet.evolutionStage}`;
  elements.petLevel.textContent = String(state.pet.level);
  elements.petXp.textContent = `${state.pet.xp} / ${nextLevelXp}`;
  elements.petStreak.textContent = `${state.pet.streakDays} days`;
  elements.assignmentCount.textContent = String(state.assignments.length);
}

function renderRecommendation() {
  const recommendation = recommendedTask();
  if (!recommendation) {
    elements.recommendationCard.innerHTML = `<div class="empty-state">Add an assignment to get a recommendation.</div>`;
    return;
  }

  elements.recommendationCard.innerHTML = `
    <span class="badge">${labelForFocusMode(state.focusMode)}</span>
    <h3>${recommendation.subject}: ${recommendation.title}</h3>
    <p>${recommendation.reason}</p>
    <p><strong>${recommendation.minutes} minutes</strong> is a good target right now.</p>
    <p>${state.statusLine}</p>
  `;
}

function renderAssignments() {
  if (state.assignments.length === 0) {
    elements.assignmentList.innerHTML = `<div class="empty-state">No assignments yet. Add one to start building quests.</div>`;
    return;
  }

  const recommended = recommendedTask();
  elements.assignmentList.innerHTML = state.assignments
    .map((assignment) => {
      const activeClass = assignment.id === state.selectedAssignmentId ? "active" : "";
      const isRecommended = recommended && recommended.id === assignment.id;
      return `
        <article class="assignment-card ${activeClass}" data-assignment-id="${assignment.id}">
          <div class="assignment-card-header">
            <div>
              <h3>${assignment.title}</h3>
              <p>${assignment.subject || "General"} · ${formatDueText(assignment.dueAt)}</p>
            </div>
            ${isRecommended ? `<span class="badge">Recommended</span>` : ""}
          </div>
          <p>${openQuestCount(assignment)} quests left · ${assignment.estimatedMinutes} estimated minutes</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${assignment.progressPercent}%"></div>
          </div>
        </article>
      `;
    })
    .join("");

  elements.assignmentList.querySelectorAll("[data-assignment-id]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedAssignmentId = card.dataset.assignmentId;
      state.statusLine = "Selected assignment";
      saveAndRender();
    });
  });
}

function renderSelectedAssignment() {
  const assignment = getSelectedAssignment();
  if (!assignment) {
    elements.selectedAssignmentTitle.textContent = "Choose an assignment";
    elements.selectedAssignmentMeta.innerHTML = "";
    elements.questList.innerHTML = `<div class="empty-state">Your selected assignment will show its quests here.</div>`;
    return;
  }

  elements.selectedAssignmentTitle.textContent = assignment.title;
  elements.selectedAssignmentMeta.innerHTML = `
    <span>${assignment.subject || "General"}</span>
    <span>${formatDueText(assignment.dueAt)}</span>
    <span>${assignment.estimatedMinutes} minutes</span>
    <span>${assignment.progressPercent}% complete</span>
  `;

  elements.questList.innerHTML = assignment.quests
    .map((quest, index) => {
      const doneClass = quest.done ? "done" : "";
      return `
        <article class="quest-card ${doneClass}">
          <div class="quest-card-header">
            <div>
              <strong>${quest.title}</strong>
              <p>${quest.description}</p>
            </div>
            <span class="badge">${quest.xpReward} XP</span>
          </div>
          <p>${quest.estimatedMinutes} minutes</p>
          ${
            quest.done
              ? `<p>Completed</p>`
              : `<button class="ghost-button" type="button" data-quest-index="${index}">Mark complete</button>`
          }
        </article>
      `;
    })
    .join("");

  elements.questList.querySelectorAll("[data-quest-index]").forEach((button) => {
    button.addEventListener("click", () => {
      completeQuestByIndex(assignment, Number(button.dataset.questIndex));
    });
  });
}

function renderSkills() {
  const entries = Object.entries(state.subjectSkills);
  if (entries.length === 0) {
    elements.skillList.innerHTML = `<div class="empty-state">Complete quests to start leveling up your subjects.</div>`;
    return;
  }

  elements.skillList.innerHTML = entries
    .sort((a, b) => b[1].xp - a[1].xp)
    .map(([subject, skill]) => {
      return `
        <article class="skill-card">
          <div class="skill-card-header">
            <div>
              <strong>${subject}</strong>
              <p>Level ${skill.level}</p>
            </div>
            <span class="badge">${skill.xp} XP</span>
          </div>
          <div class="skill-meter">
            <div class="skill-meter-fill" style="width: ${Math.min(100, (skill.xp / (skill.level * 40)) * 100)}%"></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function getSelectedAssignment() {
  return state.assignments.find((assignment) => assignment.id === state.selectedAssignmentId) || null;
}

function labelForFocusMode(modeId) {
  return focusModes.find((mode) => mode.id === modeId)?.label || "Normal";
}

function preferredMinutes(modeId) {
  return focusModes.find((mode) => mode.id === modeId)?.minutes || 25;
}

function questXpForMinutes(minutes) {
  if (minutes <= 5) {
    return 5;
  }
  if (minutes <= 12) {
    return 10;
  }
  if (minutes <= 20) {
    return 15;
  }
  if (minutes <= 30) {
    return 20;
  }
  return 25;
}

function containsWord(text, needle) {
  return String(text || "").toLowerCase().includes(needle);
}

function normalizedSubject(assignment) {
  if (assignment.subject) {
    return assignment.subject;
  }
  if (containsWord(assignment.title, "essay") || containsWord(assignment.title, "write")) {
    return "Writing";
  }
  if (containsWord(assignment.title, "math") || containsWord(assignment.title, "worksheet")) {
    return "Math";
  }
  if (containsWord(assignment.title, "read")) {
    return "Reading";
  }
  return "General";
}

function createQuest(title, description, minutes) {
  return {
    title,
    description,
    xpReward: questXpForMinutes(minutes),
    estimatedMinutes: minutes,
    done: false
  };
}

function generateOfflineQuests(assignment, focusMode) {
  const subject = normalizedSubject(assignment);
  const minutes = preferredMinutes(focusMode);
  const quests = [];

  if (subject === "History" || subject === "Writing") {
    quests.push(createQuest("Pick the angle", "Choose the topic or argument you want to make.", Math.min(minutes, 10)));
    quests.push(createQuest("Collect evidence", "Find facts, quotes, or sources you can use.", minutes));
    quests.push(createQuest("Build the outline", "List the intro, key points, and closing idea.", minutes));
    quests.push(createQuest("Write one section", "Draft the easiest section first to build momentum.", minutes));
    if (assignment.estimatedMinutes > 90) {
      quests.push(createQuest("Revise and polish", "Clean up wording and check the final structure.", minutes));
    }
  } else if (subject === "Math") {
    quests.push(createQuest("Set up your space", "Open the worksheet and mark the first doable problem.", Math.min(minutes, 5)));
    quests.push(createQuest("Solve the first chunk", "Complete a small set of problems without worrying about perfection.", minutes));
    quests.push(createQuest("Check tricky steps", "Review any mistakes and fix the hardest question.", Math.min(minutes, 15)));
    if (assignment.estimatedMinutes > 25) {
      quests.push(createQuest("Finish the last chunk", "Wrap up the remaining problems.", minutes));
    }
  } else if (subject === "Reading") {
    quests.push(createQuest("Preview the reading", "Scan headings and bold terms before diving in.", Math.min(minutes, 5)));
    quests.push(createQuest("Read one chunk", "Work through one section and underline key ideas.", minutes));
    quests.push(createQuest("Write quick notes", "Capture 3 to 5 important takeaways.", Math.min(minutes, 10)));
    if (assignment.estimatedMinutes > 30) {
      quests.push(createQuest("Read the next chunk", "Keep going with one more section.", minutes));
    }
  } else {
    quests.push(createQuest("Define the task", "Write what done looks like in one short sentence.", Math.min(minutes, 5)));
    quests.push(createQuest("Start the first step", "Do the smallest part that moves the assignment forward.", minutes));
    quests.push(createQuest("Make progress visible", "Check off what is complete and note what remains.", Math.min(minutes, 10)));
    if (assignment.estimatedMinutes > 40) {
      quests.push(createQuest("Finish another chunk", "Complete one more small piece while momentum is up.", minutes));
    }
  }

  return quests;
}

function daysUntil(dateString) {
  if (!dateString) {
    return null;
  }
  const due = new Date(`${dateString}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function recommendedTask() {
  if (!state.assignments.length) {
    return null;
  }

  let best = null;
  let bestScore = -Infinity;

  state.assignments.forEach((assignment) => {
    const remaining = openQuestCount(assignment);
    const dueIn = daysUntil(assignment.dueAt);
    const urgencyScore = dueIn === null ? 10 : Math.max(0, 60 - dueIn * 12);
    const fitScore = assignment.estimatedMinutes <= preferredMinutes(state.focusMode) ? 15 : 6;
    const progressPenalty = assignment.progressPercent;
    const score = remaining * 10 + urgencyScore + fitScore - progressPenalty;

    if (score > bestScore) {
      bestScore = score;
      best = {
        id: assignment.id,
        title: assignment.title,
        subject: assignment.subject || "General",
        minutes: Math.min(preferredMinutes(state.focusMode), assignment.estimatedMinutes),
        reason: recommendationReason(assignment, dueIn, remaining)
      };
    }
  });

  return best;
}

function recommendationReason(assignment, dueIn, remaining) {
  if (dueIn !== null && dueIn <= 1) {
    return `Highest urgency right now. There are ${remaining} quest${remaining === 1 ? "" : "s"} left and the due date is very close.`;
  }
  if (assignment.estimatedMinutes <= preferredMinutes(state.focusMode)) {
    return `This fits your current energy well and should feel easier to start.`;
  }
  return `This keeps momentum moving on a meaningful assignment without making the step too big.`;
}

function openQuestCount(assignment) {
  return assignment.quests.filter((quest) => !quest.done).length;
}

function markNextQuestDone(assignment) {
  const nextQuestIndex = assignment.quests.findIndex((quest) => !quest.done);
  if (nextQuestIndex === -1) {
    state.statusLine = "All quests already done";
    saveAndRender();
    return;
  }
  completeQuestByIndex(assignment, nextQuestIndex);
}

function completeQuestByIndex(assignment, index) {
  const quest = assignment.quests[index];
  if (!quest || quest.done) {
    return;
  }

  quest.done = true;
  addXp(quest.xpReward);
  updateSubjectSkill(normalizedSubject(assignment), quest.xpReward);

  const completedCount = assignment.quests.filter((item) => item.done).length;
  assignment.progressPercent = Math.round((completedCount / assignment.quests.length) * 100);
  state.pet.mood = "Proud";
  state.pet.streakDays += 1;
  state.statusLine = `Quest complete +${quest.xpReward} XP`;
  saveAndRender();
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

function updateSubjectSkill(subject, xpGain) {
  if (!state.subjectSkills[subject]) {
    state.subjectSkills[subject] = { xp: 0, level: 1 };
  }

  const skill = state.subjectSkills[subject];
  skill.xp += xpGain;
  while (skill.xp >= skill.level * 40) {
    skill.xp -= skill.level * 40;
    skill.level += 1;
  }
}

function avatarForPet(stage, mood) {
  if (stage >= 4) {
    return mood === "Proud" ? "^_^" : "OvO";
  }
  if (stage >= 3) {
    return mood === "Focused" ? "•ᴗ•" : "oᴗo";
  }
  if (stage >= 2) {
    return mood === "Proud" ? "◕‿◕" : "o.o";
  }
  return mood === "Exhausted" ? "-.-" : "o.o";
}

function focusMood(modeId) {
  if (modeId === "locked-in") {
    return "Focused";
  }
  if (modeId === "distracted") {
    return "Wiggly";
  }
  if (modeId === "exhausted") {
    return "Sleepy";
  }
  return "Curious";
}

function formatDueText(dateString) {
  if (!dateString) {
    return "No due date";
  }
  const dueIn = daysUntil(dateString);
  if (dueIn === 0) {
    return "Due today";
  }
  if (dueIn === 1) {
    return "Due tomorrow";
  }
  if (dueIn !== null && dueIn > 1) {
    return `Due in ${dueIn} days`;
  }
  if (dueIn !== null && dueIn < 0) {
    return `Past due by ${Math.abs(dueIn)} days`;
  }
  return dateString;
}
