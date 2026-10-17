const STORAGE_KEY = "todoAppState";
const ALARM_PREFIX = "todo-reminder:";
const NOTIFICATION_PREFIX = "todo-reminder:";

const PRIORITY_LABELS = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级",
  none: "普通"
};

let syncQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel();
  enqueueSync();
});

chrome.runtime.onStartup.addListener(() => {
  configureSidePanel();
  enqueueSync();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    enqueueSync();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const payload = alarm.name.slice(ALARM_PREFIX.length);
  const separator = payload.lastIndexOf(":");
  if (separator < 1) return;

  const todoId = payload.slice(0, separator);
  const scheduledReminderAt = Number(payload.slice(separator + 1));

  handleReminder(todoId, scheduledReminderAt).catch((error) => {
    console.error("[待办助手] 处理提醒失败：", error);
  });
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;

  chrome.notifications.clear(notificationId).catch(() => {});
  openTodoPanel().catch((error) => {
    console.error("[待办助手] 打开侧栏失败：", error);
  });
});

async function configureSidePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) return;

  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.warn("[待办助手] 侧栏行为设置失败：", error);
  }
}

function enqueueSync() {
  syncQueue = syncQueue
    .then(() => synchronize())
    .catch((error) => {
      console.error("[待办助手] 同步提醒失败：", error);
    });
}

async function synchronize() {
  const state = await loadState();
  await Promise.all([syncReminderAlarms(state), updateBadge(state)]);
}

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const state = result[STORAGE_KEY];

  if (!state || typeof state !== "object") {
    return { version: 1, groups: [], todos: [] };
  }

  return {
    version: state.version || 1,
    groups: Array.isArray(state.groups) ? state.groups : [],
    todos: Array.isArray(state.todos) ? state.todos : []
  };
}

async function syncReminderAlarms(state) {
  const existingAlarms = await chrome.alarms.getAll();
  const reminderAlarms = existingAlarms.filter((alarm) =>
    alarm.name.startsWith(ALARM_PREFIX)
  );
  const existingByName = new Map(
    reminderAlarms.map((alarm) => [alarm.name, alarm])
  );
  const wanted = new Map();
  const now = Date.now();

  for (const todo of state.todos) {
    if (
      !todo ||
      typeof todo.id !== "string" ||
      todo.completed ||
      !Number.isFinite(todo.reminderAt) ||
      todo.reminderNotifiedAt === todo.reminderAt
    ) {
      continue;
    }

    const name = `${ALARM_PREFIX}${todo.id}:${todo.reminderAt}`;
    // 已经过期的提醒（例如浏览器关闭期间错过）尽快补发。
    wanted.set(name, Math.max(todo.reminderAt, now + 1000));
  }

  for (const alarm of reminderAlarms) {
    if (!wanted.has(alarm.name)) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  for (const [name, when] of wanted) {
    const existing = existingByName.get(name);
    if (!existing || Math.abs(existing.scheduledTime - when) > 1000) {
      chrome.alarms.create(name, { when });
    }
  }
}

async function handleReminder(todoId, scheduledReminderAt) {
  const state = await loadState();
  const todo = state.todos.find((item) => item && item.id === todoId);

  if (
    !todo ||
    todo.completed ||
    !Number.isFinite(todo.reminderAt) ||
    todo.reminderAt !== scheduledReminderAt
  ) {
    return;
  }

  if (todo.reminderNotifiedAt === todo.reminderAt) return;

  const group = state.groups.find((item) => item && item.id === todo.groupId);
  const messageParts = [];

  if (group?.name) messageParts.push(`分组：${group.name}`);

  if (todo.note) {
    const note =
      todo.note.length > 240 ? `${todo.note.slice(0, 240)}…` : todo.note;
    messageParts.push(note);
  }

  if (Number.isFinite(todo.dueAt)) {
    messageParts.push(`截止时间：${formatDateTime(todo.dueAt)}`);
  }

  messageParts.push(
    `优先级：${PRIORITY_LABELS[todo.priority] || PRIORITY_LABELS.none}`
  );

  const notificationId = `${NOTIFICATION_PREFIX}${todo.id}:${todo.reminderAt}`;

  try {
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: `待办提醒：${todo.name}`,
      message: messageParts.join("\n"),
      contextMessage: "待办助手",
      priority: 2,
      requireInteraction: true
    });
  } catch (error) {
    console.error("[待办助手] 创建通知失败：", error);
  }

  await markReminderNotified(todo.id, todo.reminderAt);
}

async function markReminderNotified(todoId, reminderAt) {
  // 重新读取一次，尽量减少覆盖侧栏刚刚保存的修改。
  const state = await loadState();
  const todo = state.todos.find((item) => item && item.id === todoId);

  if (!todo || todo.reminderAt !== reminderAt) return;

  todo.reminderNotifiedAt = reminderAt;
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function updateBadge(state) {
  const openCount = state.todos.filter(
    (todo) => todo && !todo.completed
  ).length;
  const badgeText = openCount > 99 ? "99+" : String(openCount || "");

  try {
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: "#6366F1" });
    await chrome.action.setTitle({
      title: openCount
        ? `待办助手 · ${openCount} 条待办`
        : "打开待办助手"
    });
  } catch (error) {
    console.warn("[待办助手] 更新图标角标失败：", error);
  }
}

async function openTodoPanel() {
  if (chrome.sidePanel?.open) {
    try {
      const currentWindow = await chrome.windows.getLastFocused({
        windowTypes: ["normal"]
      });

      if (Number.isInteger(currentWindow?.id)) {
        await chrome.sidePanel.open({ windowId: currentWindow.id });
        return;
      }
    } catch (error) {
      console.warn("[待办助手] 侧栏打开失败，改为打开页面：", error);
    }
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL("sidepanel.html") });
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";

  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}
