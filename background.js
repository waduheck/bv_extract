// background.js - 后台脚本
// 用于保存活跃的tab连接状态
const activeTabsStatus = {};

// 监听扩展安装或更新事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`扩展已${details.reason === 'install' ? '安装' : '更新'}`);
  
  // 如果是更新，提示用户刷新页面
  if (details.reason === 'update') {
    // 获取所有标签页并设置徽章提醒用户刷新
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && tab.url.startsWith('http')) {
          chrome.action.setBadgeText({ text: 'NEW', tabId: tab.id });
          chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
        }
      });
    });
  }
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    // 只处理带有tab ID的消息
    if (sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      
      // 内容脚本加载完成的消息
      if (request.action === 'CONTENT_SCRIPT_LOADED') {
        activeTabsStatus[tabId] = {
          connected: true,
          lastActive: Date.now()
        };
        console.log(`内容脚本已在标签页 ${tabId} 中加载`);
        chrome.action.setBadgeText({ text: '', tabId });
        sendResponse({ status: 'background_received' });
      }
      
      // BV号复制的消息，转发给popup
      if (request.action === 'BV_COPIED') {
        // 这里不需要直接操作，popup会从storage获取数据
        // 但我们需要回应内容脚本
        sendResponse({ status: 'success' });
      }
    }
  } catch (error) {
    console.error('处理消息出错:', error);
    sendResponse({ status: 'error', message: error.message });
  }
  
  return true; // 表示会异步回复
});

// 当标签页被关闭时，清理其状态
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabsStatus[tabId]) {
    delete activeTabsStatus[tabId];
  }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当页面完成加载时，检查是否需要显示刷新提示
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    // 如果不是已连接的标签页，显示徽章以提示可能需要刷新
    if (!activeTabsStatus[tabId] || !activeTabsStatus[tabId].connected) {
      chrome.action.setBadgeText({ text: '!', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#F44336', tabId });
    }
  }
});

// 扩展激活时(点击图标)重置徽章
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.action.setBadgeText({ text: '', tabId: tab.id });
  }
});

// 检查内容脚本的定时任务
setInterval(() => {
  // 获取所有活跃的标签页
  chrome.tabs.query({ active: true }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id && tab.url && tab.url.startsWith('http')) {
        // 发送ping消息检查内容脚本是否还活着
        chrome.tabs.sendMessage(tab.id, { action: 'CHECK_CONTENT_SCRIPT' })
          .then(response => {
            if (response && response.status === 'alive') {
              // 更新活跃状态
              activeTabsStatus[tab.id] = {
                connected: true,
                lastActive: Date.now()
              };
            }
          })
          .catch(() => {
            // 消息发送失败，可能内容脚本未加载
            if (activeTabsStatus[tab.id] && activeTabsStatus[tab.id].connected) {
              activeTabsStatus[tab.id].connected = false;
              // 显示徽章提示刷新
              chrome.action.setBadgeText({ text: '!', tabId: tab.id });
              chrome.action.setBadgeBackgroundColor({ color: '#F44336', tabId: tab.id });
            }
          });
      }
    });
  });
}, 30000); // 每30秒检查一次 