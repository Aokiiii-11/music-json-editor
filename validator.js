class JSONValidator {
    constructor() {
        this.originalJson = null;
        this.translatedJson = null;
        this.validationResults = null;
        this.separators = ['|', '｜', '/', '／', '-', '—', '–', '·', '・', '、', ':', '：', ';', '；'];
        this.sepRegex = null;
        this.chineseRegex = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    setupEventListeners() {
        // 文件输入监听
        document.getElementById('originalFile').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'original');
        });

        document.getElementById('translatedFile').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'translated');
        });

        // 文本输入监听
        document.getElementById('originalJson').addEventListener('input', (e) => {
            this.handleTextInput(e.target.value, 'original');
        });

        document.getElementById('translatedJson').addEventListener('input', (e) => {
            this.handleTextInput(e.target.value, 'translated');
        });

        // 按钮监听
        document.getElementById('validateBtn').addEventListener('click', () => {
            this.validate();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAll();
        });

        // 视图切换监听
        document.getElementById('inlineViewToggle').addEventListener('change', (e) => {
            this.toggleViewMode(e.target.checked);
        });

        // 文件上传区域点击监听
        document.querySelectorAll('.file-upload-area').forEach(area => {
            area.addEventListener('click', () => {
                const target = area.dataset.target;
                document.getElementById(`${target}File`).click();
            });
        });
    }

    setupDragAndDrop() {
        // 为文本区域设置拖拽功能
        const textareas = document.querySelectorAll('.json-input');
        textareas.forEach(textarea => {
            textarea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                textarea.style.background = '#e3f2fd';
            });

            textarea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                textarea.style.background = 'white';
            });

            textarea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                textarea.style.background = 'white';
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].name.endsWith('.json')) {
                    const type = textarea.id.replace('Json', '');
                    this.handleFileUpload(files[0], type);
                }
            });
        });

        // 为文件上传区域设置拖拽样式
        const uploadAreas = document.querySelectorAll('.file-upload-area');
        uploadAreas.forEach(area => {
            area.addEventListener('dragover', (e) => {
                e.preventDefault();
                area.classList.add('drag-over');
            });

            area.addEventListener('dragleave', (e) => {
                e.preventDefault();
                area.classList.remove('drag-over');
            });

            area.addEventListener('drop', (e) => {
                e.preventDefault();
                area.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].name.endsWith('.json')) {
                    const target = area.dataset.target;
                    this.handleFileUpload(files[0], target);
                }
            });
        });
    }

    handleFileUpload(file, type) {
        if (!file || !file.name.endsWith('.json')) {
            alert('请选择JSON文件');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const json = JSON.parse(content);
                
                if (type === 'original') {
                    this.originalJson = json;
                    document.getElementById('originalJson').value = JSON.stringify(json, null, 2);
                } else {
                    this.translatedJson = json;
                    document.getElementById('translatedJson').value = JSON.stringify(json, null, 2);
                }
            } catch (error) {
                alert(`文件解析失败: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }

    handleTextInput(value, type) {
        try {
            if (value.trim()) {
                const json = JSON.parse(value);
                if (type === 'original') {
                    this.originalJson = json;
                } else {
                    this.translatedJson = json;
                }
            }
        } catch (error) {
            // 忽略JSON解析错误，用户可能正在输入
        }
    }

    // JSON路径扁平化
    flattenJSON(obj, prefix = '') {
        const result = {};
        
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                const path = prefix ? `${prefix}[${index}]` : `[${index}]`;
                if (typeof item === 'object' && item !== null) {
                    Object.assign(result, this.flattenJSON(item, path));
                } else {
                    result[path] = item;
                }
            });
        } else if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                const path = prefix ? `${prefix}.${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    Object.assign(result, this.flattenJSON(obj[key], path));
                } else {
                    result[path] = obj[key];
                }
            });
        } else {
            result[prefix || '$'] = obj;
        }
        
        return result;
    }

    // 构建分隔符正则
    buildSepRegex(seps) {
        const parts = seps.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        const union = parts.join('|')
        return new RegExp(`\\s*(?:${union})\\s*`, 'gu')
    }

    // 中文字符正则（优先使用 Unicode Script=Han）
    getChineseRegex() {
        if (this.chineseRegex) return this.chineseRegex
        try {
            this.chineseRegex = new RegExp('\\p{Script=Han}', 'gu')
        } catch {
            this.chineseRegex = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g
        }
        return this.chineseRegex
    }

    // 清理译文（移除中文和分隔符）
    cleanTranslatedValue(value) {
        if (typeof value !== 'string') return value
        let s = value.normalize('NFKC')
        const zh = this.getChineseRegex()
        s = s.replace(zh, '')
        if (!this.sepRegex) this.sepRegex = this.buildSepRegex(this.separators)
        s = s.replace(this.sepRegex, '')
        s = s.replace(/\s+/g, ' ').trim()
        return s
    }

    // 清理译文对象
    cleanTranslatedObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return this.cleanTranslatedValue(obj);
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.cleanTranslatedObject(item));
        }
        
        const cleaned = {};
        for (let key in obj) {
            cleaned[key] = this.cleanTranslatedObject(obj[key]);
        }
        
        return cleaned;
    }

    // 比较JSON结构
    compareJSON(original, translated) {
        const errors = [];
        const warnings = [];
        
        const originalFlat = this.flattenJSON(original);
        const cleanedTranslated = this.cleanTranslatedObject(translated);
        const translatedFlat = this.flattenJSON(cleanedTranslated);
        
        // 检查缺失的字段
        Object.keys(originalFlat).forEach(path => {
            if (!(path in translatedFlat)) {
                errors.push({
                    type: 'missing',
                    path: path,
                    message: `缺少字段: ${path}`,
                    expected: originalFlat[path],
                    actual: undefined
                });
            } else if (typeof originalFlat[path] !== typeof translatedFlat[path]) {
                errors.push({
                    type: 'type_mismatch',
                    path: path,
                    message: `类型不匹配: ${path}`,
                    expected: typeof originalFlat[path],
                    actual: typeof translatedFlat[path]
                });
            } else if (originalFlat[path] !== translatedFlat[path]) {
                errors.push({
                    type: 'value_mismatch',
                    path: path,
                    message: `值不匹配: ${path}`,
                    expected: originalFlat[path],
                    actual: translatedFlat[path]
                });
            }
        });
        
        // 检查多余的字段
        Object.keys(translatedFlat).forEach(path => {
            if (!(path in originalFlat)) {
                warnings.push({
                    type: 'extra',
                    path: path,
                    message: `多余字段: ${path}`,
                    actual: translatedFlat[path]
                });
            }
        });
        
        return { errors, warnings };
    }

    // LCS算法实现
    computeLCS(original, translated) {
        const originalLines = typeof original === 'string' ? original.split('\n') : JSON.stringify(original, null, 2).split('\n');
        const translatedLines = typeof translated === 'string' ? translated.split('\n') : JSON.stringify(translated, null, 2).split('\n');
        
        const result = {
            original: [],
            translated: []
        };
        
        // 简化的差异算法：逐行对比
        const maxLength = Math.max(originalLines.length, translatedLines.length);
        
        for (let i = 0; i < maxLength; i++) {
            const origLine = originalLines[i] || '';
            const transLine = translatedLines[i] || '';
            
            if (origLine === transLine) {
                // 行内容相同
                result.original.push({
                    content: origLine,
                    type: 'unchanged',
                    lineNumber: i + 1
                });
                result.translated.push({
                    content: transLine,
                    type: 'unchanged',
                    lineNumber: i + 1
                });
            } else if (i >= originalLines.length) {
                // 译文多出的行
                result.original.push({
                    content: '',
                    type: 'removed',
                    lineNumber: i + 1
                });
                result.translated.push({
                    content: transLine,
                    type: 'added',
                    lineNumber: i + 1
                });
            } else if (i >= translatedLines.length) {
                // 原文多出的行
                result.original.push({
                    content: origLine,
                    type: 'removed',
                    lineNumber: i + 1
                });
                result.translated.push({
                    content: '',
                    type: 'added',
                    lineNumber: i + 1
                });
            } else {
                // 行内容不同
                result.original.push({
                    content: origLine,
                    type: 'modified',
                    lineNumber: i + 1
                });
                result.translated.push({
                    content: transLine,
                    type: 'modified',
                    lineNumber: i + 1
                });
            }
        }
        
        return result;
    }

    // 渲染差异视图
    renderDiff(original, translated) {
        const diffResult = this.computeLCS(original, this.cleanTranslatedObject(translated));
        
        const originalDiff = document.getElementById('originalDiff');
        const translatedDiff = document.getElementById('translatedDiff');
        
        originalDiff.innerHTML = '';
        translatedDiff.innerHTML = '';
        
        // 渲染原文差异
        diffResult.original.forEach(line => {
            const lineDiv = document.createElement('div');
            lineDiv.className = `diff-line ${line.type}`;
            lineDiv.innerHTML = `<span class="diff-line-number">${line.lineNumber}</span>${this.escapeHtml(line.content)}`;
            originalDiff.appendChild(lineDiv);
        });
        
        // 渲染译文差异
        diffResult.translated.forEach(line => {
            const lineDiv = document.createElement('div');
            lineDiv.className = `diff-line ${line.type}`;
            lineDiv.innerHTML = `<span class="diff-line-number">${line.lineNumber}</span>${this.escapeHtml(line.content)}`;
            translatedDiff.appendChild(lineDiv);
        });
        
        // 显示差异区域
        document.getElementById('diffSection').style.display = 'block';
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 渲染校验结果
    renderResults(results) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsList = document.getElementById('resultsList');
        const statusBadge = document.getElementById('validationStatus');
        const errorCount = document.getElementById('errorCount');
        const warningCount = document.getElementById('warningCount');
        
        // 更新统计信息
        errorCount.textContent = results.errors.length;
        warningCount.textContent = results.warnings.length;
        
        // 设置状态
        if (results.errors.length === 0) {
            statusBadge.textContent = '通过';
            statusBadge.className = 'status-badge success';
        } else {
            statusBadge.textContent = '失败';
            statusBadge.className = 'status-badge error';
        }
        
        // 清空结果列表
        resultsList.innerHTML = '';
        
        // 显示错误
        results.errors.forEach(error => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <div class="result-icon error"></div>
                <span class="result-path">${error.path}</span>
                <span class="result-message">${error.message}</span>
            `;
            resultsList.appendChild(item);
        });
        
        // 显示警告
        results.warnings.forEach(warning => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <div class="result-icon warning"></div>
                <span class="result-path">${warning.path}</span>
                <span class="result-message">${warning.message}</span>
            `;
            resultsList.appendChild(item);
        });
        
        // 显示结果区域
        resultsSection.style.display = 'block';
    }

    // 切换视图模式
    toggleViewMode(inlineMode) {
        const diffContainer = document.querySelector('.diff-container');
        if (inlineMode) {
            diffContainer.style.gridTemplateColumns = '1fr';
        } else {
            diffContainer.style.gridTemplateColumns = '1fr 1fr';
        }
    }

    // 校验功能
    validate() {
        if (!this.originalJson || !this.translatedJson) {
            alert('请输入原文和译文JSON');
            return;
        }
        
        try {
            // 执行校验
            const results = this.compareJSON(this.originalJson, this.translatedJson);
            this.validationResults = results;
            
            // 渲染差异视图
            this.renderDiff(this.originalJson, this.translatedJson);
            
            // 渲染校验结果
            this.renderResults(results);
            
        } catch (error) {
            alert(`校验失败: ${error.message}`);
        }
    }

    // 清空所有数据
    clearAll() {
        this.originalJson = null;
        this.translatedJson = null;
        this.validationResults = null;
        
        // 清空输入框
        document.getElementById('originalJson').value = '';
        document.getElementById('translatedJson').value = '';
        
        // 隐藏结果区域
        document.getElementById('diffSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        
        // 重置统计
        document.getElementById('errorCount').textContent = '0';
        document.getElementById('warningCount').textContent = '0';
        document.getElementById('validationStatus').textContent = '';
        document.getElementById('validationStatus').className = 'status-badge';
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new JSONValidator();
});
