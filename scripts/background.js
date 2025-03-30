// 监听浏览器图标点击事件
// 处理图标点击和重试请求
const imageDataMap = new Map();

// 添加标签页激活监听
browser.tabs.onActivated.addListener(activeInfo => {
    console.log('标签页切换:', activeInfo.tabId);
    browser.runtime.sendMessage({
        action: 'tabChanged',
        tabId: activeInfo.tabId
    });
    // 新增关闭弹窗逻辑
    browser.runtime.sendMessage({
        action: 'closePopup'
    });
});

const handleImageFetch = async (tab) => {
    console.log('[事件触发] 开始处理图标点击事件，时间戳:', Date.now());
    console.log('[图标点击事件触发] 开始处理，tabID:', tab.id);
    const tabId = tab.id;
    try {
        browser.tabs.sendMessage(tabId, {action: 'getImages', tab: tab}).then(response => {
            console.log('[事件触发] 收到content脚本响应，时间戳:', Date.now());
            if (response.status === 'success') {
                imageDataMap.set(tabId, response.data);
                console.log('获取到图片数量:', response.data.length);
                browser.runtime.sendMessage({
                    action: 'updateImages',
                    status: 'success',
                    data: response.data,
                    tabId: tabId
                });
            } else {
                throw new Error(response.error || '未知错误');
            }
        }).catch(error => {
            console.error('通信失败:', error);
            browser.runtime.sendMessage({
                action: 'updateImages',
                status: 'error',
                data: {error: error.message},
                tabId: tabId
            });
        });
    } catch (error) {
        console.error('获取图片失败:', error);
        console.log('正在发送错误消息，tabId:', tabId);
        browser.runtime.sendMessage({
            action: 'updateImages',
            status: 'error',
            data: {error: '无法获取图片，请确保页面加载完成'},
            tabId: tabId
        });
    }
};

// 监听浏览器图标点击
console.log('[事件监听] 注册浏览器图标点击监听器');
// 移除浏览器图标点击监听
// browser.browserAction.onClicked.addListener(handleImageFetch);

// 新消息处理逻辑
// 处理标签页切换事件
browser.runtime.onMessage.addListener((request, sender) => {
    console.log('[统一消息入口] 收到消息:', JSON.stringify(request));
    const tabId = request.tabId;

    if (request.action === 'tabChanged') {
        console.log('处理标签页切换事件');
        browser.tabs.get(tabId).then(tab => handleImageFetch(tab));
        return true;
    }
    console.log(`sender.tab:${sender.tab}`)
    if (request.action === 'getImages' && Number.isFinite(tabId)) {
        console.log('立即处理弹窗图片请求');
        browser.tabs.get(tabId).then(tab => handleImageFetch(tab));
        return true;
    }

    if (request.action === 'retryFetch' && Number.isFinite(tabId)) {
        console.log('处理重试请求');
        browser.tabs.get(tabId).then(tab => handleImageFetch(tab));
        return true;
    }

    if (request.action === 'downloadImage') {
        console.log('处理下载请求');
        const filename = request.url.split('/').pop() || `image_${Date.now()}.jpg`;
        browser.downloads.download({
            url: request.url,
            filename: filename,
            conflictAction: 'uniquify',
            saveAs: false
        }).catch(console.error);
        return true;
    }

    console.warn('未处理的消息类型:', request.action);
    return false;
});
