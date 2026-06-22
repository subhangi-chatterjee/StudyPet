#include <Arduino.h>
#include <M5Cardputer.h>
#include <vector>

namespace {

enum class FocusMode {
  LockedIn,
  Normal,
  Distracted,
  Exhausted,
};

struct Quest {
  String title;
  String description;
  int xpReward = 0;
  int estimatedMinutes = 0;
  bool done = false;
};

struct Assignment {
  String title;
  String subject;
  String dueAt;
  int estimatedMinutes = 0;
  int progressPercent = 0;
  std::vector<Quest> quests;
};

struct PetState {
  String name = "Nib";
  int xp = 0;
  int level = 1;
  int streakDays = 0;
  int evolutionStage = 1;
  String mood = "curious";
};

struct AppState {
  PetState pet;
  FocusMode focusMode = FocusMode::Normal;
  std::vector<Assignment> assignments;
  int selectedAssignment = 0;
  String statusLine = "Booting study pet...";
};

AppState app;

bool containsWord(const String& text, const char* needle) {
  String lowered = text;
  lowered.toLowerCase();
  return lowered.indexOf(needle) >= 0;
}

String focusModeLabel(FocusMode mode) {
  switch (mode) {
    case FocusMode::LockedIn:
      return "Locked In";
    case FocusMode::Normal:
      return "Normal";
    case FocusMode::Distracted:
      return "Distracted";
    case FocusMode::Exhausted:
      return "Exhausted";
  }
  return "Normal";
}

int focusQuestMinutes(FocusMode mode) {
  switch (mode) {
    case FocusMode::LockedIn:
      return 35;
    case FocusMode::Normal:
      return 25;
    case FocusMode::Distracted:
      return 12;
    case FocusMode::Exhausted:
      return 5;
  }
  return 20;
}

int questXpForMinutes(int minutes) {
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

String normalizedSubject(const Assignment& assignment) {
  if (assignment.subject.length() > 0) {
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

void pushQuest(std::vector<Quest>& quests, const String& title, const String& description, int minutes) {
  Quest quest;
  quest.title = title;
  quest.description = description;
  quest.xpReward = questXpForMinutes(minutes);
  quest.estimatedMinutes = minutes;
  quest.done = false;
  quests.push_back(quest);
}

void generateOfflineQuests(Assignment& assignment) {
  assignment.quests.clear();
  const String subject = normalizedSubject(assignment);
  const int preferredMinutes = focusQuestMinutes(app.focusMode);

  if (subject == "History" || subject == "Writing") {
    pushQuest(assignment.quests, "Pick the angle", "Choose the topic or argument you want to make.", min(preferredMinutes, 10));
    pushQuest(assignment.quests, "Collect evidence", "Find facts, quotes, or sources you can use.", preferredMinutes);
    pushQuest(assignment.quests, "Build the outline", "List the intro, key points, and closing idea.", preferredMinutes);
    pushQuest(assignment.quests, "Write one section", "Draft the easiest section first to build momentum.", preferredMinutes);
    if (assignment.estimatedMinutes > 90) {
      pushQuest(assignment.quests, "Revise and polish", "Clean up wording and check the final structure.", preferredMinutes);
    }
  } else if (subject == "Math") {
    pushQuest(assignment.quests, "Set up your space", "Open the worksheet and mark the first doable problem.", min(preferredMinutes, 5));
    pushQuest(assignment.quests, "Solve the first chunk", "Complete a small set of problems without worrying about perfection.", preferredMinutes);
    pushQuest(assignment.quests, "Check tricky steps", "Review any mistakes and fix the hardest question.", min(preferredMinutes, 15));
    if (assignment.estimatedMinutes > 25) {
      pushQuest(assignment.quests, "Finish the last chunk", "Wrap up the remaining problems.", preferredMinutes);
    }
  } else if (subject == "Reading") {
    pushQuest(assignment.quests, "Preview the reading", "Scan headings and bold terms before diving in.", min(preferredMinutes, 5));
    pushQuest(assignment.quests, "Read one chunk", "Work through one section and underline key ideas.", preferredMinutes);
    pushQuest(assignment.quests, "Write quick notes", "Capture 3 to 5 important takeaways.", min(preferredMinutes, 10));
    if (assignment.estimatedMinutes > 30) {
      pushQuest(assignment.quests, "Read the next chunk", "Keep going with one more section.", preferredMinutes);
    }
  } else {
    pushQuest(assignment.quests, "Define the task", "Write what done looks like in one short sentence.", min(preferredMinutes, 5));
    pushQuest(assignment.quests, "Start the first step", "Do the smallest part that moves the assignment forward.", preferredMinutes);
    pushQuest(assignment.quests, "Make progress visible", "Check off what is complete and note what remains.", min(preferredMinutes, 10));
    if (assignment.estimatedMinutes > 40) {
      pushQuest(assignment.quests, "Finish another chunk", "Complete one more small piece while momentum is up.", preferredMinutes);
    }
  }

  assignment.progressPercent = 0;
  app.statusLine = "Built local quest chain";
}

void seedAssignments() {
  Assignment history;
  history.title = "History essay due Friday";
  history.subject = "History";
  history.dueAt = "2026-06-03";
  history.estimatedMinutes = 120;

  Assignment math;
  math.title = "Math worksheet chapter 8";
  math.subject = "Math";
  math.dueAt = "2026-05-31";
  math.estimatedMinutes = 30;

  app.assignments.push_back(history);
  app.assignments.push_back(math);
  for (auto& assignment : app.assignments) {
    generateOfflineQuests(assignment);
  }
}

void addXp(int amount) {
  app.pet.xp += amount;
  while (app.pet.xp >= app.pet.level * 50) {
    app.pet.xp -= app.pet.level * 50;
    app.pet.level += 1;
    if (app.pet.level == 3 || app.pet.level == 6 || app.pet.level == 10) {
      app.pet.evolutionStage += 1;
    }
  }
}

String recommendedTask() {
  if (app.assignments.empty()) {
    return "No assignments yet";
  }

  int bestIndex = 0;
  int bestScore = -9999;
  for (size_t i = 0; i < app.assignments.size(); ++i) {
    const auto& assignment = app.assignments[i];
    int remainingQuests = 0;
    for (const auto& quest : assignment.quests) {
      if (!quest.done) {
        remainingQuests++;
      }
    }

    int score = remainingQuests * 10;
    if (assignment.dueAt == "2026-05-31") {
      score += 50;
    }
    if (assignment.estimatedMinutes <= focusQuestMinutes(app.focusMode)) {
      score += 15;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = static_cast<int>(i);
    }
  }

  const auto& selected = app.assignments[bestIndex];
  return selected.subject + ": " + selected.title;
}

void drawUi() {
  M5Cardputer.Display.fillScreen(BLACK);
  M5Cardputer.Display.setCursor(4, 6);
  M5Cardputer.Display.setTextColor(GREEN);
  M5Cardputer.Display.setTextSize(1);
  M5Cardputer.Display.printf("Study Pet: %s\n", app.pet.name.c_str());
  M5Cardputer.Display.printf("Lvl %d  XP %d  Evo %d\n", app.pet.level, app.pet.xp, app.pet.evolutionStage);
  M5Cardputer.Display.printf("Mood: %s\n", app.pet.mood.c_str());
  M5Cardputer.Display.printf("Focus: %s\n\n", focusModeLabel(app.focusMode).c_str());

  M5Cardputer.Display.setTextColor(WHITE);
  M5Cardputer.Display.println("Assignments:");
  for (size_t i = 0; i < app.assignments.size(); ++i) {
    const bool selected = static_cast<int>(i) == app.selectedAssignment;
    M5Cardputer.Display.setTextColor(selected ? YELLOW : WHITE);
    M5Cardputer.Display.printf("%c %s\n", selected ? '>' : '-', app.assignments[i].title.c_str());
  }

  M5Cardputer.Display.setTextColor(CYAN);
  M5Cardputer.Display.printf("\nNext: %s\n", recommendedTask().c_str());
  M5Cardputer.Display.setTextColor(LIGHTGREY);
  M5Cardputer.Display.printf("\nA=Rebuild  B=Done  `=Focus\n");
  M5Cardputer.Display.printf("%s\n", app.statusLine.c_str());
}

void cycleFocusMode() {
  switch (app.focusMode) {
    case FocusMode::LockedIn:
      app.focusMode = FocusMode::Normal;
      break;
    case FocusMode::Normal:
      app.focusMode = FocusMode::Distracted;
      break;
    case FocusMode::Distracted:
      app.focusMode = FocusMode::Exhausted;
      break;
    case FocusMode::Exhausted:
      app.focusMode = FocusMode::LockedIn;
      break;
  }
  app.statusLine = "Adjusted brain mode";
}

void markFirstOpenQuestDone(Assignment& assignment) {
  for (auto& quest : assignment.quests) {
    if (!quest.done) {
      quest.done = true;
      addXp(quest.xpReward);
      assignment.progressPercent = min(100, assignment.progressPercent + 25);
      app.pet.mood = "proud";
      app.statusLine = "Quest complete +" + String(quest.xpReward) + " XP";
      return;
    }
  }

  app.statusLine = "All quests already done";
}

void handleKeyboard() {
  M5Cardputer.update();
  if (!M5Cardputer.Keyboard.isChange()) {
    return;
  }

  if (M5Cardputer.Keyboard.isKeyPressed(';')) {
    if (!app.assignments.empty()) {
      app.selectedAssignment = (app.selectedAssignment + 1) % app.assignments.size();
      app.statusLine = "Moved selection";
    }
  }

  if (M5Cardputer.Keyboard.isKeyPressed('.')) {
    if (!app.assignments.empty()) {
      app.selectedAssignment = (app.selectedAssignment - 1 + app.assignments.size()) % app.assignments.size();
      app.statusLine = "Moved selection";
    }
  }

  if (M5Cardputer.Keyboard.isKeyPressed('a') || M5Cardputer.Keyboard.isKeyPressed('A')) {
    if (!app.assignments.empty()) {
      generateOfflineQuests(app.assignments[app.selectedAssignment]);
    }
  }

  if (M5Cardputer.Keyboard.isKeyPressed('b') || M5Cardputer.Keyboard.isKeyPressed('B')) {
    if (!app.assignments.empty()) {
      markFirstOpenQuestDone(app.assignments[app.selectedAssignment]);
    }
  }

  if (M5Cardputer.Keyboard.isKeyPressed('`')) {
    cycleFocusMode();
  }
}

}  // namespace

void setup() {
  auto cfg = M5.config();
  M5Cardputer.begin(cfg, true);
  Serial.begin(115200);

  seedAssignments();
  app.statusLine = "Offline study pet ready";
  drawUi();
}

void loop() {
  handleKeyboard();
  drawUi();
  delay(60);
}
