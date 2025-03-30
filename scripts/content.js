browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(`收到消息:${JSON.stringify(request)}, 来自:${sender?.tab?.id}, 响应:${sendResponse}`);
    if (request.action === 'getImages') {
        console.log('开始处理图片获取请求');
        getPageImages(request.tab, sendResponse);
    } else {
        console.log('未处理的消息:', JSON.stringify(request));
    }
});

// 封装图片获取逻辑
function getPageImages(tab, sendResponse) {
    const targetElement = document.querySelector('.swiper-wrapper');
    if (targetElement) {
        try {
            const images = [...new Set(Array.from(
                document.querySelectorAll('.swiper-wrapper .img-container img')
            ).map(img => img.src))];
            sendResponse({
                status: 'success',
                data: images,
                tabId: tab.id
            });
        } catch (error) {
            console.error('图片获取失败:', error);
            sendResponse({
                status: 'error',
                error: error.message
            });
        }
    } else {
        sendResponse({
            status: 'error',
            error: '目标元素未找到',
            tabId: tab.id
        });
    }
}

// 仅保留元素观察用于自动初始化
const innerObserver = new MutationObserver(() => {
    if (document.querySelector('.swiper-wrapper')) {
        innerObserver.disconnect();
        // 元素出现时主动通知
        browser.runtime.sendMessage({
            action: 'elementReady'
        });
    } else {
        console.log('未处理的消息:', JSON.stringify(request));
    }
});