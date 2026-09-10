const BLOCK_RULE_ID = 1;
const ALLOW_START = 1000;
const ALARM_NAME = 'lifeos-focus-end';

const DEFAULT_PROFILES = {
  coding: {
    id: 'coding', name: 'Coding', icon: '⌘', color: '#8de1ff',
    sites: ['chatgpt.com', 'leetcode.com', 'github.com', 'stackoverflow.com', 'developer.mozilla.org', 'docs.oracle.com']
  },
  study: {
    id: 'study', name: 'Study', icon: '◌', color: '#ffd28a',
    sites: ['google.com', 'youtube.com', 'coursera.org', 'wikipedia.org', 'docs.google.com']
  },
  research: {
    id: 'research', name: 'Research', icon: '⌁', color: '#c9b8ff',
    sites: ['google.com', 'chatgpt.com', 'wikipedia.org', 'arxiv.org', 'scholar.google.com']
  }
};

async function getState() {
  const data = await chrome.storage.local.get(['profiles', 'focusSession']);
  return {
    profiles: data.profiles || DEFAULT_PROFILES,
    focusSession: data.focusSession || null
  };
}

function normalizeDomain(value) {
  try {
    const input = value.includes('://') ? value : `https://${value}`;
    return new URL(input).hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

async function syncBlockingRules() {
  const { profiles, focusSession } = await getState();
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = oldRules.map(r => r.id);
  if (!focusSession?.active) {
    if (removeRuleIds.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    return;
  }

  const profile = profiles[focusSession.profileId];
  const domains = [...new Set((profile?.sites || []).map(normalizeDomain).filter(Boolean))];
  const allowRules = domains.map((domain, index) => ({
    id: ALLOW_START + index,
    priority: 100,
    action: { type: 'allow' },
    condition: { requestDomains: [domain], resourceTypes: ['main_frame'] }
  }));
  const blockRule = {
    id: BLOCK_RULE_ID,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { resourceTypes: ['main_frame'] }
  };
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: [blockRule, ...allowRules]
  });
}

async function finishFocus(reason = 'completed') {
  const { focusSession } = await getState();
  if (!focusSession?.active) return;
  const now = Date.now();
  const actualMs = Math.max(0, Math.min(now - focusSession.startedAt, focusSession.durationMs));
  const history = (await chrome.storage.local.get('focusHistory')).focusHistory || [];
  history.unshift({ ...focusSession, active: false, status: reason, endedAt: now, actualMs });
  await chrome.storage.local.set({ focusSession: null, focusHistory: history.slice(0, 500) });
  await chrome.alarms.clear(ALARM_NAME);
  await syncBlockingRules();
  if (reason === 'completed') {
    await chrome.notifications?.create?.({
      type: 'basic', iconUrl: 'icon128.svg', title: 'Focus complete', message: `${focusSession.profileName} session finished.`
    }).catch(() => {});
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['profiles', 'widgets', 'themeSettings']);
  if (!data.profiles) await chrome.storage.local.set({ profiles: DEFAULT_PROFILES });
  if (!data.widgets) await chrome.storage.local.set({ widgets: ['deepWork', 'github', 'habits', 'upcoming'] });
  if (!data.themeSettings) await chrome.storage.local.set({ themeSettings: { backgroundMode: 'time', customBackground: null } });
  await syncBlockingRules();
});

chrome.runtime.onStartup.addListener(syncBlockingRules);
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM_NAME) finishFocus('completed'); });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'START_FOCUS') {
      const { profiles } = await getState();
      const profile = profiles[message.profileId];
      if (!profile) throw new Error('Unknown focus profile');
      const durationMs = Math.max(1, Number(message.minutes) || 25) * 60 * 1000;
      const session = {
        id: crypto.randomUUID(), active: true, profileId: profile.id, profileName: profile.name,
        startedAt: Date.now(), endsAt: Date.now() + durationMs, durationMs
      };
      await chrome.storage.local.set({ focusSession: session });
      await chrome.alarms.create(ALARM_NAME, { when: session.endsAt });
      await syncBlockingRules();
      sendResponse({ ok: true, session });
    } else if (message.type === 'END_FOCUS') {
      await finishFocus('ended'); sendResponse({ ok: true });
    } else if (message.type === 'SYNC_RULES') {
      await syncBlockingRules(); sendResponse({ ok: true });
    }
  })().catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
