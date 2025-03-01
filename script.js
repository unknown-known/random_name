// DOM元素
const themeSelect = document.getElementById('theme-select');
const excelUpload = document.getElementById('excel-upload');
const fileNameDisplay = document.getElementById('file-name');
const uploadBtn = document.getElementById('upload-btn');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const nameList = document.getElementById('name-list');
const nameCount = document.getElementById('name-count');
const errorMessage = document.getElementById('error-message');
const selectCountInput = document.getElementById('select-count');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const toggleUploadBtn = document.getElementById('toggle-upload');
const uploadPanel = document.getElementById('upload-panel');
// 弹窗元素
const resultModal = document.getElementById('result-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close-modal');
const confirmModal = document.getElementById('confirm-modal');

// 应用状态
let names = [];
let selectedFile = null;
let isRolling = false;
let rollInterval = null;
let lastSelectedIndices = [];
let selectionHistory = [];
let isUploadPanelVisible = false;
let scrollTimeout = null;
let historyCount = 0; // 添加一个历史记录计数器

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 加载保存的主题（如果有）
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    themeSelect.value = savedTheme;
    
    // 加载历史记录
    loadHistory();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 检查xlsx库是否加载成功
    setTimeout(() => {
        if (typeof XLSX === 'undefined') {
            showError('Excel解析库加载失败，请检查网络连接或刷新页面重试。');
        }
    }, 1000);
});

// 加载历史记录
function loadHistory() {
    try {
        const savedHistory = localStorage.getItem('nameSelectionHistory');
        if (savedHistory) {
            selectionHistory = JSON.parse(savedHistory);
            
            // 加载历史计数器
            historyCount = parseInt(localStorage.getItem('historyCount') || '0');
            if (isNaN(historyCount) || historyCount < selectionHistory.length) {
                historyCount = selectionHistory.length;
            }
            
            updateHistoryDisplay();
        }
    } catch (error) {
        console.error('加载历史记录失败:', error);
        // 如果加载失败，初始化为空数组
        selectionHistory = [];
        historyCount = 0;
    }
}

// 保存历史记录
function saveHistory() {
    try {
        localStorage.setItem('nameSelectionHistory', JSON.stringify(selectionHistory));
        localStorage.setItem('historyCount', historyCount.toString());
    } catch (error) {
        console.error('保存历史记录失败:', error);
        showError('保存历史记录失败，可能是存储空间不足');
    }
}

// 清空历史记录
function clearHistory() {
    selectionHistory = [];
    historyCount = 0;
    saveHistory();
    updateHistoryDisplay();
}

// 设置所有事件监听器
function setupEventListeners() {
    // 主题切换
    themeSelect.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });
    
    // 切换上传面板显示
    toggleUploadBtn.addEventListener('click', () => {
        isUploadPanelVisible = !isUploadPanelVisible;
        if (isUploadPanelVisible) {
            uploadPanel.style.display = 'block';
            toggleUploadBtn.querySelector('.toggle-icon').textContent = '➖';
        } else {
            uploadPanel.style.display = 'none';
            toggleUploadBtn.querySelector('.toggle-icon').textContent = '➕';
        }
    });
    
    // 文件选择
    excelUpload.addEventListener('change', (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            fileNameDisplay.textContent = selectedFile.name;
            uploadBtn.disabled = false;
            
            // 清除之前的错误信息
            hideError();
        } else {
            fileNameDisplay.textContent = '未选择文件';
            uploadBtn.disabled = true;
        }
    });
    
    // 上传按钮
    uploadBtn.addEventListener('click', () => {
        if (selectedFile) {
            // 清除之前的错误信息
            hideError();
            
            // 显示处理状态
            setStatusMessage('正在解析文件...');
            
            // 稍微延迟处理，让UI能够更新
            setTimeout(() => {
                parseExcelFile(selectedFile);
            }, 100);
        }
    });
    
    // 开始点名按钮
    startBtn.addEventListener('click', startRandomSelection);
    
    // 停止点名按钮
    stopBtn.addEventListener('click', stopRandomSelection);
    
    // 选择人数限制
    selectCountInput.addEventListener('change', () => {
        let value = parseInt(selectCountInput.value);
        
        // 确保值在有效范围内
        if (isNaN(value) || value < 1) {
            value = 1;
        } else if (names.length > 0 && value > names.length) {
            value = names.length;
        } else if (value > 10) {
            value = 10;
        }
        
        selectCountInput.value = value;
    });
    
    // 清空历史按钮
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
            clearHistory();
        }
    });

    // 监听滚动事件来添加滚动中的类
    nameList.addEventListener('scroll', () => {
        document.body.classList.add('scrolling');
        
        // 清除之前的定时器
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        // 滚动停止后移除类
        scrollTimeout = setTimeout(() => {
            document.body.classList.remove('scrolling');
        }, 300);
    });
    
    // 监听历史列表的滚动事件
    historyList.addEventListener('scroll', () => {
        document.body.classList.add('scrolling');
        
        // 清除之前的定时器
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        // 滚动停止后移除类
        scrollTimeout = setTimeout(() => {
            document.body.classList.remove('scrolling');
        }, 300);
    });
    
    // 弹窗关闭按钮
    closeModal.addEventListener('click', hideResultModal);
    
    // 弹窗确认按钮
    confirmModal.addEventListener('click', hideResultModal);
    
    // 点击弹窗外部关闭
    resultModal.addEventListener('click', (e) => {
        if (e.target === resultModal) {
            hideResultModal();
        }
    });
    
    // ESC键关闭弹窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && resultModal.classList.contains('show')) {
            hideResultModal();
        }
    });
}

// 显示结果弹窗
function showResultModal(selectedNames) {
    // 准备弹窗内容
    modalBody.innerHTML = '';
    
    // 添加结果说明
    const resultInfo = document.createElement('p');
    resultInfo.textContent = `本次随机点名选中了 ${selectedNames.length} 人：`;
    modalBody.appendChild(resultInfo);
    
    // 创建选中名字列表
    const namesList = document.createElement('div');
    namesList.className = 'selected-names-list';
    
    // 添加每个选中的名字
    selectedNames.forEach((name, index) => {
        const nameItem = document.createElement('div');
        nameItem.className = 'selected-name-item';
        nameItem.textContent = name;
        // 延迟显示，有序出现的动画效果
        nameItem.style.animationDelay = `${index * 0.1}s`;
        namesList.appendChild(nameItem);
    });
    
    modalBody.appendChild(namesList);
    
    // 显示弹窗
    resultModal.classList.add('show');
    
    // 添加弹窗事件处理
    document.body.style.overflow = 'hidden'; // 防止背景滚动
}

// 隐藏结果弹窗
function hideResultModal() {
    resultModal.classList.remove('show');
    document.body.style.overflow = ''; // 恢复背景滚动
}

// 在名单列表中显示状态信息
function setStatusMessage(message) {
    // 清空名单列表
    nameList.innerHTML = '';
    
    // 创建一个状态信息元素
    const statusElement = document.createElement('div');
    statusElement.className = 'status-message';
    statusElement.style.gridColumn = '1 / -1'; // 跨越所有列
    statusElement.textContent = message;
    
    // 添加到名单列表
    nameList.appendChild(statusElement);
}

// 设置主题
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// 显示错误信息
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    console.error(message);
}

// 隐藏错误信息
function hideError() {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
}

// 解析Excel文件
function parseExcelFile(file) {
    // 检查XLSX库是否已加载
    if (typeof XLSX === 'undefined') {
        showError('Excel解析库未加载成功，请刷新页面重试。');
        setStatusMessage('准备开始');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            let workbook;
            const data = new Uint8Array(e.target.result);
            
            try {
                // 尝试使用标准方式解析
                workbook = XLSX.read(data, { type: 'array' });
            } catch (initialError) {
                console.warn('标准解析失败，尝试备用方法', initialError);
                
                // 备用解析方法
                try {
                    workbook = XLSX.read(e.target.result, { type: 'binary' });
                } catch (backupError) {
                    console.error('备用解析也失败了', backupError);
                    throw new Error('无法解析Excel文件，尝试了多种方法均失败');
                }
            }
            
            // 确保工作簿包含至少一个工作表
            if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error('Excel文件不包含任何工作表');
            }
            
            // 获取第一个工作表
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            if (!worksheet) {
                throw new Error('无法访问工作表内容');
            }
            
            // 将工作表转换为JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            
            // 检查是否有数据
            if (!jsonData || jsonData.length === 0) {
                throw new Error('Excel文件不包含任何数据');
            }
            
            // 提取名单
            processNameList(jsonData);
            
            // 解析成功后隐藏上传面板
            isUploadPanelVisible = false;
            uploadPanel.style.display = 'none';
            toggleUploadBtn.querySelector('.toggle-icon').textContent = '➕';
            
        } catch (error) {
            console.error('Excel解析错误:', error);
            showError(`解析Excel文件失败: ${error.message || '请检查文件格式！'}`);
            setStatusMessage('准备开始');
        }
    };
    
    reader.onerror = function(error) {
        console.error('文件读取错误:', error);
        showError('读取文件发生错误，请重新选择文件！');
        setStatusMessage('准备开始');
    };
    
    // 根据文件类型选择不同的读取方法
    const fileType = file.name.toLowerCase();
    if (fileType.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

// 处理名单数据
function processNameList(data) {
    // 重置名单
    names = [];
    
    try {
        // 检查数据格式
        if (Array.isArray(data)) {
            // 如果是二维数组格式（适用于sheet_to_json使用header:1选项的情况）
            if (data.length > 0 && Array.isArray(data[0])) {
                // 查找可能包含名字的列（假设第一行是标题）
                let nameColumnIndex = -1;
                
                // 如果有标题行，尝试找到名字列
                if (data[0].length > 0) {
                    for (let i = 0; i < data[0].length; i++) {
                        const header = String(data[0][i]).toLowerCase();
                        if (header.includes('name') || header.includes('姓名') || header.includes('名字')) {
                            nameColumnIndex = i;
                            break;
                        }
                    }
                    
                    // 如果没找到明确的名字列，使用第一列
                    if (nameColumnIndex === -1) {
                        nameColumnIndex = 0;
                    }
                    
                    // 从第二行开始提取名字（跳过标题行）
                    for (let i = 1; i < data.length; i++) {
                        if (data[i] && data[i][nameColumnIndex] !== undefined && data[i][nameColumnIndex] !== '') {
                            const name = String(data[i][nameColumnIndex]).trim();
                            if (name) {
                                names.push(name);
                            }
                        }
                    }
                } else {
                    // 没有标题行，直接使用第一列
                    for (let i = 0; i < data.length; i++) {
                        if (data[i] && data[i][0] !== undefined && data[i][0] !== '') {
                            const name = String(data[i][0]).trim();
                            if (name) {
                                names.push(name);
                            }
                        }
                    }
                }
            } else if (data.length > 0 && typeof data[0] === 'object') {
                // 对象数组格式（适用于默认的sheet_to_json输出）
                // 尝试获取第一行的所有键作为列名
                const firstRow = data[0];
                const keys = Object.keys(firstRow);
                
                // 查找可能包含人名的列
                let nameKey = null;
                for (const key of keys) {
                    const lowerKey = String(key).toLowerCase();
                    if (lowerKey.includes('name') || lowerKey.includes('姓名') || lowerKey.includes('名字')) {
                        nameKey = key;
                        break;
                    }
                }
                
                // 如果没找到明确的名字列，使用第一列
                if (!nameKey && keys.length > 0) {
                    nameKey = keys[0];
                }
                
                // 提取所有名字
                if (nameKey) {
                    data.forEach(row => {
                        if (row[nameKey] !== undefined && row[nameKey] !== '') {
                            const name = String(row[nameKey]).trim();
                            if (name) {
                                names.push(name);
                            }
                        }
                    });
                }
            } else if (data.length > 0) {
                // 尝试处理简单的一维数组
                data.forEach(item => {
                    if (item !== undefined && item !== '') {
                        const name = String(item).trim();
                        if (name) {
                            names.push(name);
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('处理名单数据时出错:', error);
        showError('处理名单数据时出错: ' + error.message);
    }
    
    // 更新UI显示
    if (names.length > 0) {
        // 限制选择人数不能超过总人数
        if (parseInt(selectCountInput.value) > names.length) {
            selectCountInput.value = names.length;
        }
        
        updateNameListDisplay();
        startBtn.disabled = false;
        hideError(); // 成功解析，隐藏错误信息
    } else {
        showError('没有找到有效的名单数据，请检查Excel文件格式！');
        setStatusMessage('准备开始');
        startBtn.disabled = true;
    }
}

// 更新名单显示
function updateNameListDisplay() {
    // 清空当前列表
    nameList.innerHTML = '';
    
    // 更新计数
    nameCount.textContent = `(${names.length})`;
    
    // 添加所有名字到列表
    names.forEach((name, index) => {
        const nameItem = document.createElement('div');
        nameItem.className = 'name-item';
        nameItem.textContent = name;
        nameItem.dataset.index = index;
        nameList.appendChild(nameItem);
    });
}

// 开始随机选择
function startRandomSelection() {
    if (names.length === 0 || isRolling) return;
    
    // 获取用户设置的选择人数
    const selectCount = parseInt(selectCountInput.value);
    if (isNaN(selectCount) || selectCount < 1) {
        selectCountInput.value = 1;
        return;
    }
    
    // 确保选择人数不超过名单总数
    const actualSelectCount = Math.min(selectCount, names.length);
    
    isRolling = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    // 初始化所有名字项的样式
    resetNameItemStyles();
    
    // 重置上次选择的索引数组
    lastSelectedIndices = [];
    
    // 添加is-rolling类，优化滚动显示
    nameList.classList.add('is-rolling');
    
    // 设置随机滚动间隔
    rollInterval = setInterval(() => {
        // 生成不重复的随机索引组
        const randomIndices = getRandomIndices(actualSelectCount, names.length, lastSelectedIndices);
        
        // 更新名字列表中的选中状态
        updateSelectedItemsInList(randomIndices);
        
        // 保存这次的索引，供下次使用
        lastSelectedIndices = randomIndices;
    }, 100); // 快速滚动，每100毫秒更新一次
}

// 获取随机不重复索引
function getRandomIndices(count, max, lastIndices) {
    const indices = [];
    
    // 如果要选择的数量等于或超过最大值，直接返回所有索引的随机排序
    if (count >= max) {
        for (let i = 0; i < max; i++) {
            indices.push(i);
        }
        // 随机打乱顺序
        return shuffleArray(indices);
    }
    
    // 生成不重复的随机索引
    while (indices.length < count) {
        const randomIndex = Math.floor(Math.random() * max);
        
        // 确保不与上次的索引重复（如果有多个索引且人数足够）
        if (lastIndices.length > 0 && count < max && lastIndices.includes(randomIndex)) {
            continue;
        }
        
        // 确保不在当前选择的列表中重复
        if (!indices.includes(randomIndex)) {
            indices.push(randomIndex);
        }
    }
    
    return indices;
}

// 随机打乱数组
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// 更新列表中选中项的样式
function updateSelectedItemsInList(indices) {
    // 先清除所有选中状态
    resetNameItemStyles();
    
    // 设置新的选中状态
    indices.forEach(index => {
        const selectedItem = nameList.querySelector(`[data-index="${index}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            
            // 在滚动过程中不进行滚动，避免滚动条频繁显示
            // 只更新选中状态
        }
    });
}

// 停止随机选择
function stopRandomSelection() {
    if (!isRolling) return;
    
    clearInterval(rollInterval);
    isRolling = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    // 移除is-rolling类
    nameList.classList.remove('is-rolling');
    
    // 获取选中的项目
    const selectedItems = nameList.querySelectorAll('.name-item.selected');
    
    // 收集选中的名字
    const selectedNames = [];
    selectedItems.forEach(item => {
        const index = parseInt(item.dataset.index);
        if (!isNaN(index) && index >= 0 && index < names.length) {
            selectedNames.push(names[index]);
        }
    });
    
    // 添加高亮动画效果
    selectedItems.forEach(item => {
        item.classList.add('highlight');
    });
    
    // 停止后，滚动到第一个选中项（确保选中项可见）
    if (selectedItems.length > 0) {
        setTimeout(() => {
            // 延迟滚动，让用户能先看到高亮效果
            selectedItems[0].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }, 300);
    }
    
    // 记录当前选择到历史记录
    addToHistory();
    
    // 显示结果弹窗
    if (selectedNames.length > 0) {
        setTimeout(() => {
            showResultModal(selectedNames);
        }, 800); // 延迟显示，让用户先看到高亮效果
    }
    
    // 移除高亮效果
    setTimeout(() => {
        selectedItems.forEach(item => {
            item.classList.remove('highlight');
        });
    }, 1000);
}

// 添加到历史记录
function addToHistory() {
    // 获取当前选中的名字
    const selectedNames = [];
    const selectedItems = nameList.querySelectorAll('.name-item.selected');
    
    selectedItems.forEach(item => {
        const index = parseInt(item.dataset.index);
        if (!isNaN(index) && index >= 0 && index < names.length) {
            selectedNames.push(names[index]);
        }
    });
    
    if (selectedNames.length > 0) {
        // 递增历史计数
        historyCount++;
        
        // 创建历史记录项
        const historyItem = {
            names: selectedNames,
            timestamp: new Date().toISOString(),
            count: selectedNames.length,
            historyIndex: historyCount  // 存储正确的历史索引
        };
        
        // 添加到历史数组的前面（最新的在最前面）
        selectionHistory.unshift(historyItem);
        
        // 限制历史记录数量，最多保留50条
        if (selectionHistory.length > 50) {
            selectionHistory = selectionHistory.slice(0, 50);
        }
        
        // 保存到本地存储
        saveHistory();
        
        // 更新历史显示
        updateHistoryDisplay();
        
        // 滚动历史记录到顶部
        if (historyList.firstChild) {
            historyList.scrollTop = 0;
        }
    }
}

// 更新历史记录显示
function updateHistoryDisplay() {
    // 清空历史列表
    historyList.innerHTML = '';
    
    // 如果没有历史记录，显示提示
    if (selectionHistory.length === 0) {
        const noHistory = document.createElement('div');
        noHistory.className = 'no-history';
        noHistory.textContent = '暂无历史记录';
        historyList.appendChild(noHistory);
        return;
    }
    
    // 添加所有历史记录
    selectionHistory.forEach((item) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        // 创建历史项头部（时间和序号）
        const header = document.createElement('div');
        header.className = 'history-item-header';
        
        const timeElement = document.createElement('span');
        timeElement.className = 'history-time';
        const date = new Date(item.timestamp);
        timeElement.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        const indexElement = document.createElement('span');
        indexElement.className = 'history-index';
        // 使用保存的历史索引，如果没有则使用历史计数器减去当前索引
        const historyNumber = item.historyIndex || (historyCount - selectionHistory.indexOf(item));
        indexElement.textContent = `第 ${historyNumber} 次点名`;
        
        header.appendChild(indexElement);
        header.appendChild(timeElement);
        
        // 创建名字列表
        const namesContainer = document.createElement('div');
        namesContainer.className = 'history-item-names';
        
        item.names.forEach(name => {
            const nameElement = document.createElement('span');
            nameElement.className = 'history-name';
            nameElement.textContent = name;
            namesContainer.appendChild(nameElement);
        });
        
        // 组装历史项
        historyItem.appendChild(header);
        historyItem.appendChild(namesContainer);
        
        // 添加到历史列表
        historyList.appendChild(historyItem);
    });
}

// 重置名单项目样式
function resetNameItemStyles() {
    const items = nameList.querySelectorAll('.name-item');
    items.forEach(item => {
        item.classList.remove('selected');
        item.classList.remove('highlight');
    });
} 