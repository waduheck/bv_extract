"use strict";
// 存储当前模式状态
let isBVModeEnabled = false;

// 检查扩展上下文是否有效
function isExtensionContextValid() {
  try {
    // 尝试访问chrome.runtime.id，如果失败则上下文无效
    return !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// 安全的消息发送函数
const safeSendMessage = async (message) => {
  if (!isExtensionContextValid()) {
    console.warn('扩展上下文已失效，无法发送消息');
    return false;
  }
  
  try {
    return await chrome.runtime.sendMessage(message).catch(() => false);
  } catch (error) {
    console.warn('发送消息失败:', error);
    return false;
  }
};

// 安全的存储访问函数
const safeStorageGet = async (keys) => {
  if (!isExtensionContextValid()) {
    console.warn('扩展上下文已失效，无法访问存储');
    return {};
  }
  
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
  if (!isExtensionContextValid()) {
    console.warn('扩展上下文已失效，无法设置存储');
    return false;
  }
  
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

// 防抖函数
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// 设置视觉反馈样式
const setVisualFeedback = debounce((enabled) => {
  const videos = document.querySelectorAll('a[href*="/video/BV"]');
  videos.forEach(video => {
    if (!video || !video.parentElement) return;
    
    video.style.cursor = enabled ? 'copy' : '';
    
    // 移除已存在的覆盖层
    const existingOverlay = video.querySelector('.bv-mode-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    if (enabled) {
      const overlay = document.createElement('div');
      overlay.className = 'bv-mode-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.1);
        z-index: 1000;
        pointer-events: none;
      `;
      video.appendChild(overlay);
    }
  });
  
  // 如果开启了模式，同时标记已复制的视频
  if (enabled) {
    markAllCopiedVideos();
  }
}, 100);

// 标记已复制视频的函数
const markCopiedVideo = (bvNumber) => {
  try {
    const videoLinks = document.querySelectorAll(`a[href*="/video/${bvNumber}"]`);
    videoLinks.forEach(link => {
      // 添加已复制的标记类
      link.classList.add('bv-copied');
      
      // 如果存在覆盖层，更新它的样式
      const overlay = link.querySelector('.bv-mode-overlay');
      if (overlay) {
        overlay.classList.add('bv-copied-overlay');
      } else if (isBVModeEnabled) {
        // 只在BV模式下添加新覆盖层
        const newOverlay = document.createElement('div');
        newOverlay.className = 'bv-mode-overlay bv-copied-overlay';
        newOverlay.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(76, 175, 80, 0.1);
          z-index: 1000;
          pointer-events: none;
        `;
        link.appendChild(newOverlay);
      }
      
      // 添加勾号标记
      if (!link.querySelector('.bv-check-mark')) {
        const checkMark = document.createElement('div');
        checkMark.className = 'bv-check-mark';
        checkMark.innerHTML = '✓';
        checkMark.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          background: #4CAF50;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          z-index: 1001;
          pointer-events: none;
        `;
        link.appendChild(checkMark);
      }
    });
  } catch (error) {
    console.warn('标记视频失败:', error);
  }
};

// 标记所有已复制的视频
async function markAllCopiedVideos() {
  try {
    const result = await safeStorageGet(['bvHistory']);
    const bvHistory = result.bvHistory || [];
    if (bvHistory.length > 0) {
      bvHistory.forEach(bvNumber => {
        markCopiedVideo(bvNumber);
      });
    }
  } catch (error) {
    console.warn('标记所有视频失败:', error);
  }
}

// 获取BV号并复制到剪贴板
const getAndCopyBV = async (url) => {
  try {
    const match = url.match(/\/video\/(BV\w+)/);
    if (!match || !match[1]) return null;
    
    const bvNumber = match[1];
    
    // 先保存到历史记录
    try {
      const result = await safeStorageGet(['bvHistory']);
      const bvHistory = result.bvHistory || [];
      
      if (!bvHistory.includes(bvNumber)) {
        const newHistory = [bvNumber, ...bvHistory].slice(0, 50); // 最多保存50条记录
        await safeStorageSet({ bvHistory: newHistory });
        
        // 通知 popup 更新列表
        safeSendMessage({
          action: 'BV_COPIED',
          bv: bvNumber
        });
      }
      
      // 为当前视频元素添加已复制的标记
      markCopiedVideo(bvNumber);
      
      // 复制到剪贴板
      try {
        await navigator.clipboard.writeText(bvNumber);
        showNotification(`已复制BV号：${bvNumber}`);
      } catch (clipboardError) {
        console.error('复制到剪贴板失败:', clipboardError);
        // 降级方案：创建一个临时输入框并复制
        const textarea = document.createElement('textarea');
        textarea.value = bvNumber;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification(`已复制BV号：${bvNumber}`);
      }
      
      return bvNumber;
    } catch (storageError) {
      console.error('保存BV号到历史记录失败:', storageError);
      // 尝试直接复制
      await navigator.clipboard.writeText(bvNumber);
      showNotification(`已复制BV号：${bvNumber}（未保存到历史记录）`);
      return bvNumber;
    }
  } catch (error) {
    console.error('复制BV号时出错:', error);
    showNotification('复制BV号失败，请刷新页面重试');
    return null;
  }
};

// 显示通知
const showNotification = (() => {
  let currentNotification = null;
  
  return (message) => {
    if (currentNotification) {
      currentNotification.remove();
    }
    
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
    
    currentNotification = notification;
    setTimeout(() => {
      if (currentNotification === notification) {
        notification.remove();
        currentNotification = null;
      }
    }, 2000);
  };
})();

// 处理视频点击事件
const handleVideoClick = (event) => {
  if (!isBVModeEnabled) return;
  
  const anchor = event.target.closest('a[href*="/video/BV"]');
  if (anchor) {
    event.preventDefault();
    event.stopPropagation();
    getAndCopyBV(anchor.href);
  }
};

// 切换BV获取模式
const toggleBVMode = (enabled) => {
  try {
    isBVModeEnabled = enabled;
    
    // 移除之前的事件监听器
    document.removeEventListener('click', handleVideoClick, true);
    
    if (enabled) {
      // 添加新的事件监听器
      document.addEventListener('click', handleVideoClick, true);
      setVisualFeedback(true);
    } else {
      setVisualFeedback(false);
    }
  } catch (error) {
    console.error('切换模式时出错:', error);
  }
};

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'TOGGLE_BV_MODE') {
      toggleBVMode(request.enabled);
      sendResponse({ status: 'success' });
    } else if (request.action === 'CLEAR_COPIED_MARKS') {
      clearCopiedMarks();
      sendResponse({ status: 'success' });
    } else if (request.action === 'CHECK_CONTENT_SCRIPT') {
      // 响应内容脚本检查请求
      sendResponse({ status: 'alive', version: '1.0' });
    }
  } catch (error) {
    console.error('处理消息出错:', error);
    sendResponse({ status: 'error', message: error.message });
  }
  return true;
});

// 清除所有已复制视频的视觉标记
function clearCopiedMarks() {
  try {
    // 移除所有勾号标记
    document.querySelectorAll('.bv-check-mark').forEach(mark => {
      mark.remove();
    });
    
    // 移除所有已复制覆盖层和类
    document.querySelectorAll('.bv-copied').forEach(link => {
      link.classList.remove('bv-copied');
      const overlay = link.querySelector('.bv-copied-overlay');
      if (overlay) {
        overlay.classList.remove('bv-copied-overlay');
      }
    });
    
    showNotification('已清除所有标记');
  } catch (error) {
    console.error('清除标记出错:', error);
    showNotification('清除标记失败，请刷新页面重试');
  }
}

// 使用MutationObserver处理动态加载内容
const observer = new MutationObserver(
  debounce((mutations) => {
    if (isBVModeEnabled) {
      setVisualFeedback(true);
    } else {
      // 即使不在BV模式，也要标记已复制的视频
      markAllCopiedVideos();
    }
  }, 200)
);

// 添加样式到页面
const style = document.createElement('style');
style.textContent = `
  .bv-mode-overlay:hover {
    background: rgba(0, 0, 0, 0.2) !important;
  }
  
  .bv-copied-overlay {
    background: rgba(76, 175, 80, 0.1) !important;
  }
  
  .bv-copied-overlay:hover {
    background: rgba(76, 175, 80, 0.2) !important;
  }
  
  a.bv-copied {
    position: relative;
  }
  
  .bv-check-mark {
    opacity: 0.85;
    transition: opacity 0.2s;
  }
  
  a:hover .bv-check-mark {
    opacity: 1;
  }
`;
document.head.appendChild(style);

// 主初始化函数
async function main() {
  try {
    // 初始化时获取BV模式状态
    const result = await safeStorageGet(['isBVModeEnabled']);
    if (result.isBVModeEnabled !== undefined) {
      toggleBVMode(result.isBVModeEnabled);
    }
    
    // 标记所有已复制的视频，无论是否开启BV模式
    await markAllCopiedVideos();
    
    // 观察DOM变化，处理动态加载的内容
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: false,
          characterData: false
        });
      });
    }
    
    // 注入监听扩展上下文变化的检测
    window.addEventListener('error', (event) => {
      // 检查是否是扩展上下文失效错误
      if (event.message && event.message.includes('Extension context invalidated')) {
        console.warn('检测到扩展上下文已失效，请刷新页面');
        showNotification('扩展状态已更改，请刷新页面以继续使用');
      }
    });
    
    // 发送内容脚本已加载的消息
    safeSendMessage({ action: 'CONTENT_SCRIPT_LOADED' });
    
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

// 等待DOM加载完成后执行main函数
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
