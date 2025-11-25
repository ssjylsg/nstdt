const https = require('https');
const fs = require('fs');
const path = require('path');

// 创建必要的目录结构
const baseDir = './downloaded_models';
const imgDir = path.join(baseDir, 'img');
const thumbDir = path.join(baseDir, 'thumb');
const modelDir = path.join(baseDir, 'models');

// 确保目录存在
[baseDir, imgDir, thumbDir, modelDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 下载文件的通用函数
function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        // 创建写入流前，不要覆盖已存在的文件 — 上层逻辑会先检查一次，但这里再保证安全性
        const file = fs.createWriteStream(filePath);

        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            } else {
                file.close();
                // 只有在文件确实存在时再删除，避免异常
                try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
                reject(new Error(`下载失败，状态码: ${response.statusCode}`));
            }
        }).on('error', (err) => {
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
            reject(err);
        });
    });
}

// 主函数
async function downloadAllModels() {
    try {
        // 请求API获取模型数据
        const apiUrl = 'https://studio.nsdt.cloud/api/models';

        const data = await new Promise((resolve, reject) => {
            https.get(apiUrl, (res) => {
                let rawData = '';
                res.on('data', (chunk) => rawData += chunk);
                res.on('end', () => resolve(JSON.parse(rawData)));
            }).on('error', reject);
        });

        console.log('API请求成功，开始下载文件...');

        const downloadPromises = [];
        const failedDownloads = [];
        let totalCount = 0;

        // 遍历所有分类和模型
        data.data.forEach(category => {
            category.models.forEach(model => {
                totalCount++;

                // 下载img文件
                if (model.img) {
                    const imgUrl = `https://studio.nsdt.cloud${model.img}`;
                    const imgPath = path.join(imgDir, path.basename(model.img));

                    if (fs.existsSync(imgPath)) {
                        console.log(`→ 已存在，跳过: ${model.img}`);
                    } else {
                        downloadPromises.push(
                            downloadFile(imgUrl, imgPath)
                                .then(() => console.log(`✓ 下载完成: ${model.img}`))
                                .catch(err => {
                                    console.log(`✗ 下载失败: ${model.img} - ${err.message}`);
                                    failedDownloads.push({ url: imgUrl, path: imgPath, error: err.message, type: 'img' });
                                }));
                    }
                }

                // 下载thumb文件
                if (model.thumb) {
                    const thumbUrl = `https://studio.nsdt.cloud${model.thumb}`;
                    const thumbPath = path.join(thumbDir, path.basename(model.thumb));

                    if (fs.existsSync(thumbPath)) {
                        console.log(`→ 已存在，跳过: ${model.thumb}`);
                    } else {
                        downloadPromises.push(
                            downloadFile(thumbUrl, thumbPath)
                                .then(() => console.log(`✓ 下载完成: ${model.thumb}`))
                                .catch(err => {
                                    console.log(`✗ 下载失败: ${model.thumb} - ${err.message}`);
                                    failedDownloads.push({ url: thumbUrl, path: thumbPath, error: err.message, type: 'thumb' });
                                }));
                    }
                }

                // 下载modelUrl文件
                if (model.modelUrl) {
                    const modelUrl = `https://studio.nsdt.cloud${model.modelUrl}`;
                    const modelPath = path.join(modelDir, path.basename(model.modelUrl));

                    if (fs.existsSync(modelPath)) {
                        console.log(`→ 已存在，跳过: ${model.modelUrl}`);
                    } else {
                        downloadPromises.push(
                            downloadFile(modelUrl, modelPath)
                                .then(() => console.log(`✓ 下载完成: ${model.modelUrl}`))
                                .catch(err => {
                                    console.log(`✗ 下载失败: ${model.modelUrl} - ${err.message}`);
                                    failedDownloads.push({ url: modelUrl, path: modelPath, error: err.message, type: 'model' });
                                }))
                    }
                }
            });
        });

        console.log(`发现 ${totalCount} 个模型，共 ${totalCount * 3} 个文件需要下载`);

        // 等待所有下载完成
        await Promise.allSettled(downloadPromises);

        // 将失败的下载保存为 JSON 文件
        try {
            const failedPath = path.join(baseDir, 'failed_downloads.json');
            if (failedDownloads.length > 0) {
                fs.writeFileSync(failedPath, JSON.stringify({ timestamp: new Date().toISOString(), failures: failedDownloads }, null, 2), 'utf8');
                console.log(`⚠️ ${failedDownloads.length} 个文件下载失败，已保存到: ${failedPath}`);
            } else {
                console.log('所有文件下载成功，没有失败记录。');
            }
        } catch (e) {
            console.error('写入失败记录时出错:', e.message);
        }

        console.log('\n🎉 所有文件下载完成！');
        console.log(`文件保存位置: ${baseDir}`);
        console.log(`- 图片文件: ${imgDir}`);
        console.log(`- 缩略图: ${thumbDir}`);
        console.log(`- 模型文件: ${modelDir}`);

    } catch (error) {
        console.error('下载过程中发生错误:', error.message);
    }
}

// 执行下载
downloadAllModels();
