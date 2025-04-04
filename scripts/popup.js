// 初始化选中图片数组
// 按标签页存储状态
const tabData = new Map();
let currentTabId = null;

// 添加DOM加载完成监听
document.addEventListener('DOMContentLoaded', () => {
    // 先获取当前标签页ID
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        currentTabId = tabs[0].id;
        console.log(`弹窗加载完成，发送获取图片请求, 标签页ID:${currentTabId}`);

        console.log(`!currentTabId:${!currentTabId}`);
        if (Number.isFinite(!currentTabId)) {
            console.error('无法获取当前标签页ID');
            showError('无法获取当前标签页ID');
            return;
        }
        console.log('发送获取图片请求');
        browser.runtime.sendMessage({
            action: 'getImages',
            tabId: currentTabId
        });
        tabData.set(currentTabId, {
            selectedUrls: [],
            scriptStatus: 'executing'
        });
        initForTab(currentTabId);
    });
});


// 监听标签页切换
// 监听来自后台脚本的标签页变更消息
browser.runtime.onMessage.addListener(request => {
    if (request.action === 'tabChanged') {
        console.log('收到后台标签页变更通知:', request.tabId);
        currentTabId = request.tabId;
        initForTab(currentTabId);
    }
});

browser.tabs.onActivated.addListener(activeInfo => {
    console.log('标签页切换:', activeInfo.tabId);
    currentTabId = activeInfo.tabId;
    initForTab(currentTabId);
});

function initForTab(tabId) {
    console.log('初始化标签页:', tabId);
    if (!tabData.has(tabId)) {
        console.log('创建新标签页数据');
        tabData.set(tabId, {
            selectedUrls: [],
            scriptStatus: 'not_started'
        });
    }
    updateDisplay(tabId);
}

browser.runtime.onMessage.addListener((request) => {
    console.log('完整消息对象:', JSON.stringify(request));
    console.log('收到运行时消息:', request.action);
    if (request.action === 'updateImages') {
        console.log('更新图片数据:', request);
        const tabId = request.tabId;
        const status = request.status;
        console.log(`tabId:${tabId}, status:${status}`);
        if (!tabData.has(tabId)) {
            tabData.set(tabId, {
                selectedUrls: [],
                scriptStatus: status
            });
        }

        const data = tabData.get(tabId);
        data.scriptStatus = status;
        console.log(`tabId:${tabId}, status:${status}, data:${JSON.stringify(data)}`);
        if (status === 'executing') {
            showLoading();
        } else if (status === 'success') {
            hideLoading();
            request.data.length >= 0 ? renderImages(request.data) : showEmpty();
            data.selectedUrls = []; // 重置选中状态
        } else if (request.data?.error) {
            showError(`脚本执行失败: ${request.data.error}`);
        }

        // 仅当当前标签页匹配时更新显示
        if (tabId === currentTabId) {
            updateDisplay(tabId);
        }
    } else {
        console.log('未处理的消息:', JSON.stringify(request));
    }
});

// 渲染图片网格
function renderImages(urls) {
    const grid = document.getElementById('image-grid');
    grid.innerHTML = '';

    urls.forEach(url => {
        const item = document.createElement('div');
        item.className = 'image-item';

        // 添加复选框
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox-label';
        // checkbox.checked = data.selectedUrls.includes(url);
        checkbox.onchange = (e) => {
            console.log(`e:${JSON.stringify(e)}`)
            e.stopPropagation();
            const data = tabData.get(currentTabId);
            const currentUrl = checkbox.closest('.image-item').querySelector('img').src;

            if (e.target.checked) {
                data.selectedUrls = [...new Set([...data.selectedUrls, currentUrl])];
            } else {
                data.selectedUrls = data.selectedUrls.filter(u => u !== currentUrl);
            }
            console.log(`checked:${e.target.checked}`)
            checkbox.checked = !e.target.checked; // 同步DOM状态
        };

        // 添加缩略图
        const img = document.createElement('img');
        img.src = url;

        // 添加新标签页打开按钮
        const openBtn = document.createElement('button');
        openBtn.className = 'open-button';
        openBtn.innerHTML = '↗';
        openBtn.onclick = () => window.open(url);

        // 处理整个item点击（排除按钮区域）
        item.onclick = (e) => {
            const isOpenButton = e.target.closest('.open-button');
            if (!isOpenButton) {
                checkbox.checked = !checkbox.checked;
                const data = tabData.get(currentTabId);
                console.log(`tabId: ${currentTabId},data:${JSON.stringify(data)}`);
                if (checkbox.checked) {
                    data.selectedUrls.push(url);
                    checkbox.checked = true;
                } else {
                    data.selectedUrls = data.selectedUrls.filter(u => u !== url);
                    checkbox.checked = false;
                }
            }
        };

        item.appendChild(checkbox);
        item.appendChild(openBtn);
        item.appendChild(img);
        grid.appendChild(item);
    });

    // 新增控制按钮显隐逻辑
    // 互斥显示逻辑
    hideAll()

    // 仅在成功且图片数量大于0时显示操作按钮
    if (urls.length > 0) {
        document.querySelector('.image-grid').style.display = 'grid';
        document.querySelector('.controls').classList.remove('hidden');
    } else {
        document.querySelector('.image-grid').style.display = 'none';
        document.querySelector('.controls').classList.add('hidden');
        document.querySelector('.empty-message').style.display = 'block';
    }
}

// 全选/反选功能
document.getElementById('toggle-all').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.checkbox-label');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => cb.checked = !allChecked);
    const data = tabData.get(currentTabId);
    data.selectedUrls = allChecked ? [] : Array.from(document.querySelectorAll('img')).map(img => img.src);
});

// 下载选中图片
document.getElementById('download-selected').addEventListener('click', async () => {
    const checkedItems = document.querySelectorAll('.image-item input:checked');

    if (checkedItems.length === 0) {
        showError('请先选择要下载的图片');
        return;
    }

    Array.from(checkedItems).forEach(checkbox => {
        const img = checkbox.closest('.image-item').querySelector('img');
        browser.runtime.sendMessage({
            action: 'downloadImage',
            url: img.src
        });
    });
});

// 显示加载状态
function showLoading() {
    document.querySelector('.loading-overlay').style.display = 'flex';
    document.querySelector('.error-message').style.display = 'none';
    document.getElementById('image-grid').style.display = 'none';
}

// 隐藏加载状态
function hideLoading() {
    document.querySelector('.loading-overlay').style.display = 'none';
    document.getElementById('image-grid').style.display = 'grid';
}

// 显示错误信息
function showError(message) {
    document.querySelector('.error-message p').textContent = message;
    document.querySelector('.error-message').style.display = 'block';
    document.getElementById('image-grid').style.display = 'none';
    document.querySelector('.loading-overlay').style.display = 'none';
}

// 初始化时显示加载状态
showLoading();

// 重试按钮点击事件
document.getElementById('retry-button').addEventListener('click', () => {
    showLoading();
    browser.runtime.sendMessage({ action: 'retryFetch' });
});

// 图片加载完成回调
function onImagesLoaded() {
    loadingOverlay.style.display = 'none';

    // 根据图片数量显示控制按钮
    if (imageUrls.length > 0) {
        controls.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
    }
}

// 更新界面显示状态
function updateDisplay(tabId) {
    const data = tabData.get(tabId);
    // 强制隐藏所有状态容器
    hideAll();

    if (data.scriptStatus === 'executing') {
        showLoading();
    } else if (data.scriptStatus === 'success') {
        // 仅在存在图片数据时显示操作界面
        const hasImages = document.getElementById('image-grid').children.length > 0;
        document.getElementById('image-grid').style.display = hasImages ? 'grid' : 'none';
        document.querySelector('.controls').classList.toggle('hidden', !hasImages);
    } else {
        document.querySelector('.empty-message').style.display = 'block';
    }
}

function showLoading() {
    hideAll()
    document.querySelector('.loading-overlay').style.display = 'flex';
}

function showError(message) {
    hideAll()
    document.querySelector('.controls').classList.add('hidden');
    document.querySelector('.error-message p').textContent = message;
    document.querySelector('.error-message').style.display = 'block';
}

function showEmpty() {
    hideAll();
    document.querySelector('.empty-message').style.display = 'block';
}

// 强制隐藏所有状态容器
function hideAll() {
    document.querySelectorAll('.loading-overlay, .error-message, .empty-message, .image-grid').forEach(el => el.style.display = 'none');
}