#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <M5Cardputer.h>
#include <vector>

namespace {

constexpr const char* WIFI_SSID = "YOUR_WIFI_SSID";
constexpr const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
constexpr const char* API_BASE_URL = "https://your-study-backend.example.com";

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

void seedAssignments() {
  Assignment history;
  history.title = "History essay due Friday";
  history.subject = "History";
  history.dueAt = "2026-06-03";
  history.estimatedMinutes = 120;
  history.quests = {
      {"Choose a topic", "Pick one essay angle and write a one-sentence thesis.", 10, 10, false},
      {"Find 3 sources", "Collect three useful sources and note why each matters.", 15, 15, false},
      {"Create outline", "Write intro, body points, and closing bullets.", 20, 20, false},
  };

  Assignment math;
  math.title = "Math worksheet chapter 8";
  math.subject = "Math";
  math.dueAt = "2026-05-31";
  math.estimatedMinutes = 30;
  math.quests = {
      {"Solve problems 1-5", "Warm up with the first five questions.", 10, 10, false},
      {"Solve problems 6-10", "Finish the second half of the worksheet.", 15, 15, false},
  };

  app.assignments.push_back(history);
  app.assignments.push_back(math);
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
  M5Cardputer.Display.printf("\nA=Quest  B=Done  `=Focus\n");
  M5Cardputer.Display.printf("%s\n", app.statusLine.c_str());
}

bool connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 12000) {
    delay(250);
  }

  return WiFi.status() == WL_CONNECTED;
}

String buildQuestRequestJson(const Assignment& assignment) {
  StaticJsonDocument<1024> doc;
  JsonObject assignmentObj = doc["assignment"].to<JsonObject>();
  assignmentObj["title"] = assignment.title;
  assignmentObj["subject"] = assignment.subject;
  assignmentObj["due_at"] = assignment.dueAt;
  assignmentObj["estimated_minutes"] = assignment.estimatedMinutes;
  doc["focus_mode"] = focusModeLabel(app.focusMode);

  String body;
  serializeJson(doc, body);
  return body;
}

bool fetchGeneratedQuests(Assignment& assignment) {
  if (WiFi.status() != WL_CONNECTED) {
    app.statusLine = "Wi-Fi not connected";
    return false;
  }

  HTTPClient http;
  const String url = String(API_BASE_URL) + "/quests";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  const int responseCode = http.POST(buildQuestRequestJson(assignment));
  if (responseCode <= 0) {
    app.statusLine = "Quest API error";
    http.end();
    return false;
  }

  const String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(4096);
  const auto error = deserializeJson(doc, payload);
  if (error) {
    app.statusLine = "Bad quest JSON";
    return false;
  }

  assignment.quests.clear();
  for (JsonObject item : doc["quests"].as<JsonArray>()) {
    Quest quest;
    quest.title = item["title"] | "Untitled quest";
    quest.description = item["description"] | "";
    quest.xpReward = item["xp_reward"] | 10;
    quest.estimatedMinutes = item["estimated_minutes"] | focusQuestMinutes(app.focusMode);
    assignment.quests.push_back(quest);
  }

  app.statusLine = "Generated quest chain";
  return true;
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
      fetchGeneratedQuests(app.assignments[app.selectedAssignment]);
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
  if (connectWifi()) {
    app.statusLine = "Wi-Fi ready";
  } else {
    app.statusLine = "Offline demo mode";
  }
  drawUi();
}

void loop() {
  handleKeyboard();
  drawUi();
  delay(60);
}
