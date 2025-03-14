// 安全的存储访问函数
const safeStorageGet = async (keys) => {
  try {
    return await new Promise(resolve => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          console.warn('存储访问错误:', chrome.runtime.lastError);
          resolve({});
        } else {
          resolve(result);
        }
      });
    });
  } catch (error) {
    console.warn('访问存储失败:', error);
    return {};
  }
};

// 安全的存储设置函数
const safeStorageSet = async (data) => {
  try {
    return await new Promise(resolve => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.warn('存储设置错误:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.warn('设置存储失败:', error);
    return false;
  }
};

// 安全的消息发送函数
const safeSendMessage = async (tabId, message) => {
  try {
    // 先检查tab是否存在
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0] || !tabs[0].id) {
      showNotification('找不到活动标签页，请刷新页面');
      return { error: 'no_active_tab' };
    }
    
    // 使用tabId或使用活动标签页的ID
    const targetTabId = tabId || tabs[0].id;
    
    // 尝试发送消息，并设置超时
    return await Promise.race([
      chrome.tabs.sendMessage(targetTabId, message).catch(error => {
        return { error: error.message || '通信失败' };
      }),
      new Promise(resolve => setTimeout(() => resolve({ error: 'timeout' }), 2000))
    ]);
  } catch (error) {
    console.warn('发送消息失败:', error);
    return { error: error.message || '通信失败' };
  }
};

// 获取页面元素
const modeToggle = document.getElementById('modeToggle');
const statusText = document.getElementById('statusText');

// 初始化状态
const initialize = async () => {
  if (!modeToggle || !statusText) return;

  const result = await safeStorageGet(['isBVModeEnabled']);
  const isEnabled = Boolean(result.isBVModeEnabled);
  modeToggle.checked = isEnabled;
  updateStatusText(isEnabled);
};

// 更新状态显示
function updateStatusText(enabled) {
  if (statusText) {
    statusText.textContent = `当前模式：${enabled ? '开启' : '关闭'}`;
    statusText.style.color = enabled ? '#00a1d6' : '#666';
  }
}

// 更新UI状态
const updateUI = (enabled) => {
  const toggleButton = document.getElementById('toggleMode');
  const statusText = document.getElementById('status');
  
  if (toggleButton) {
    toggleButton.classList.toggle('active', enabled);
    toggleButton.textContent = enabled ? '关闭BV获取模式' : '开启BV获取模式';
  }
  
  if (statusText) {
    statusText.textContent = enabled ? '当前模式：点击视频仅复制BV号' : '当前模式：正常浏览模式';
    statusText.className = enabled ? 'status-active' : 'status-inactive';
  }
};

// 更新BV号列表
const updateBVList = (bvList) => {
  const tableBody = document.getElementById('bvList');
  const emptyState = document.getElementById('emptyState');
  const bvTable = document.querySelector('.bv-table');
  const clearAllBtn = document.getElementById('clearAll');

  if (!bvList || bvList.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (bvTable) bvTable.style.display = 'none';
    if (clearAllBtn) clearAllBtn.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (bvTable) bvTable.style.display = 'table';
  if (clearAllBtn) clearAllBtn.style.display = 'block';
  
  if (tableBody) {
    tableBody.innerHTML = bvList.map((bv, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${bv}</td>
        <td>
          <button class="copy-btn" data-bv="${bv}">复制</button>
        </td>
      </tr>
    `).join('');
  }
};

// 处理BV号复制
const handleBVCopy = (bv, showNotification = true) => {
  try {
    // 创建一个临时输入框并复制
    const textarea = document.createElement('textarea');
    textarea.value = bv;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    if (showNotification) {
      // 显示复制成功提示
      showNotification(`已复制：${bv}`);
    }
  } catch (error) {
    console.error('复制到剪贴板失败:', error);
    // 尝试使用clipboard API
    navigator.clipboard.writeText(bv)
      .then(() => {
        if (showNotification) {
          showNotification(`已复制：${bv}`);
        }
      })
      .catch(error => {
        console.error('Clipboard API失败:', error);
        showNotification('复制失败，请手动复制');
      });
  }
};

// 处理一键复制所有BV号
const handleCopyAll = async () => {
  const result = await safeStorageGet(['bvHistory']);
  const bvHistory = result.bvHistory || [];
  if (bvHistory.length === 0) {
    showNotification('没有可复制的BV号');
    return;
  }
  
  const bvString = bvHistory.join('\n');
  try {
    // 创建一个临时输入框并复制
    const textarea = document.createElement('textarea');
    textarea.value = bvString;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    showNotification(`已复制全部 ${bvHistory.length} 个BV号`);
  } catch (error) {
    console.error('复制到剪贴板失败:', error);
    // 尝试使用clipboard API
    navigator.clipboard.writeText(bvString)
      .then(() => {
        showNotification(`已复制全部 ${bvHistory.length} 个BV号`);
      })
      .catch(error => {
        console.error('Clipboard API失败:', error);
        showNotification('复制失败，请手动复制');
      });
  }
};

// 显示通知
const showNotification = (message) => {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
    pointer-events: none;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 2000);
};

// 检查内容脚本是否存在并响应
const checkContentScriptStatus = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0] || !tabs[0].id) return false;
  
  // 添加状态指示器
  const statusIndicator = document.createElement('div');
  statusIndicator.id = 'connectionStatus';
  statusIndicator.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #F44336;
  `;
  document.body.appendChild(statusIndicator);
  
  try {
    const response = await safeSendMessage(tabs[0].id, { action: 'CHECK_CONTENT_SCRIPT' });
    if (response && response.status === 'alive') {
      statusIndicator.style.backgroundColor = '#4CAF50';
      return true;
    } else {
      // 显示提示按钮
      const refreshButton = document.createElement('button');
      refreshButton.id = 'refreshButton';
      refreshButton.textContent = '刷新页面重新激活扩展';
      refreshButton.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        padding: 4px 8px;
        background: #F44336;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 10px;
        cursor: pointer;
      `;
      refreshButton.addEventListener('click', () => {
        chrome.tabs.reload(tabs[0].id);
        window.close();
      });
      document.body.appendChild(refreshButton);
      return false;
    }
  } catch (error) {
    console.error('检查内容脚本状态出错:', error);
    // 显示提示按钮
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refreshButton';
    refreshButton.textContent = '刷新页面重新激活扩展';
    refreshButton.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      padding: 4px 8px;
      background: #F44336;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
    `;
    refreshButton.addEventListener('click', () => {
      chrome.tabs.reload(tabs[0].id);
      window.close();
    });
    document.body.appendChild(refreshButton);
    return false;
  }
};

// 处理模式切换
const handleModeToggle = async () => {
  const currentState = await safeStorageGet(['isBVModeEnabled']);
  const newState = !currentState.isBVModeEnabled;
  
  await safeStorageSet({ isBVModeEnabled: newState });
  updateUI(newState);
  
  // 向content script发送消息
  const response = await safeSendMessage(null, {
    action: 'TOGGLE_BV_MODE',
    enabled: newState
  });
  
  if (response && response.error) {
    showNotification(`无法切换模式: ${response.error === 'timeout' ? '连接超时' : response.error}`);
    
    // 提示用户刷新页面
    const refreshButton = document.getElementById('refreshButton');
    if (!refreshButton) {
      const refreshButton = document.createElement('button');
      refreshButton.id = 'refreshButton';
      refreshButton.textContent = '刷新页面重新激活扩展';
      refreshButton.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        padding: 4px 8px;
        background: #F44336;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 10px;
        cursor: pointer;
      `;
      refreshButton.addEventListener('click', async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.reload(tabs[0].id);
          window.close();
        }
      });
      document.body.appendChild(refreshButton);
    }
  }
};

// 清空BV列表
const clearBVList = async () => {
  await safeStorageSet({ bvHistory: [] });
  updateBVList([]);
  
  // 通知内容脚本清除所有视觉标记
  const response = await safeSendMessage(null, {
    action: 'CLEAR_COPIED_MARKS'
  });
  
  if (response && response.error) {
    // 即使内容脚本没有响应，也不影响清空本地存储
    console.warn('清除标记通知失败:', response.error);
    showNotification('已清空所有BV号记录（标记可能需要刷新页面后清除）');
  } else {
    showNotification('已清空所有BV号记录');
  }
};

// 初始化popup
document.addEventListener('DOMContentLoaded', async () => {
  // 检查内容脚本状态
  await checkContentScriptStatus();
  
  // 绑定按钮点击事件
  const toggleButton = document.getElementById('toggleMode');
  if (toggleButton) {
    toggleButton.addEventListener('click', handleModeToggle);
  }
  
  // 绑定清空按钮事件
  const clearAllBtn = document.getElementById('clearAll');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearBVList);
  }
  
  // 绑定一键复制按钮事件
  const copyAllBtn = document.getElementById('copyAll');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', handleCopyAll);
  }
  
  // 绑定BV号复制事件
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-btn')) {
      const bv = e.target.dataset.bv;
      if (bv) {
        handleBVCopy(bv);
      }
    }
  });
  
  // 获取当前状态并更新UI
  const { isBVModeEnabled, bvHistory = [] } = await safeStorageGet(['isBVModeEnabled', 'bvHistory']);
  updateUI(isBVModeEnabled || false);
  updateBVList(bvHistory);
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'BV_COPIED') {
      // 重新获取完整的历史记录并更新UI
      safeStorageGet(['bvHistory']).then(result => {
        const bvHistory = result.bvHistory || [];
        updateBVList(bvHistory);
      });
    }
    sendResponse({ status: 'success' });
  } catch (error) {
    console.error('处理消息出错:', error);
    sendResponse({ status: 'error', message: error.message });
  }
  return true;
});

// 错误处理
window.addEventListener('error', (error) => {
  console.error('扩展运行错误:', error);
  
  // 显示错误通知
  showNotification('扩展出现错误，请刷新页面重试');
}); 