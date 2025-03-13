# GitHub 仓库设置指南

本文档提供将项目上传到 GitHub 的步骤指南。

## 准备工作

1. 确保您已安装 Git
2. 拥有一个 GitHub 账号

## 步骤

### 1. 创建新的 GitHub 仓库

1. 登录您的 GitHub 账号
2. 点击右上角的 "+" 图标，选择 "New repository"
3. 填写仓库名称，如 `bilibili-bv-extract`
4. 添加仓库描述：`B站BV号批量获取器 - 快速复制B站视频BV号，支持已复制视频的视觉标记`
5. 选择公开仓库（Public）
6. 不要选择"使用README初始化仓库"，因为我们已经有了自己的README文件
7. 点击 "Create repository"

### 2. 初始化本地 Git 仓库并推送到 GitHub

打开终端，进入项目目录，执行以下命令：

```bash
# 初始化Git仓库
git init

# 添加所有文件到暂存区
git add .

# 提交第一个版本
git commit -m "初始版本：B站BV号批量获取器 v1.1"

# 设置远程仓库地址（将URL替换为您的GitHub仓库地址）
git remote add origin https://github.com/yourusername/bilibili-bv-extract.git

# 推送代码到主分支
git push -u origin main
```

> 注意：如果您的Git默认分支是master而不是main，请使用：`git push -u origin master`

### 3. 配置 GitHub Pages（可选）

如果您想提供在线文档和演示，可以启用GitHub Pages：

1. 在GitHub仓库页面，点击 "Settings"
2. 在左侧导航栏找到 "Pages"
3. 在"Source"下选择 "main" 分支和 "/docs" 文件夹
4. 点击 "Save"

设置后，您的文档将会在 `https://yourusername.github.io/bilibili-bv-extract` 提供访问。

### 4. 添加发布版本

为了让用户方便下载扩展文件，您可以创建一个发布版本：

1. 在GitHub仓库页面，点击 "Releases" 或者 "Create a new release"
2. 点击 "Draft a new release"
3. 填写版本号，如 `v1.1`
4. 填写发布标题，如 `B站BV号批量获取器 v1.1`
5. 填写发布说明，可以包含新功能和改进说明
6. 上传 `bilibili-bv-extract.zip` 文件作为附件
7. 点击 "Publish release"

## 维护仓库

### 更新代码

当您对代码进行修改后，可以使用以下命令更新GitHub仓库：

```bash
# 添加修改的文件
git add .

# 提交变更
git commit -m "更新说明：修复了xxx问题，添加了xxx功能"

# 推送到GitHub
git push
```

### 创建新版本

当有重大更新时，您可以创建新的发布版本：

1. 更新 `manifest.json` 中的版本号
2. 更新 `package.json` 中的版本号
3. 更新 `README.md` 中的更新日志
4. 提交并推送更改
5. 按照上面的"添加发布版本"步骤创建新的发布

## 常见问题

### 推送失败

如果遇到推送错误，可能是因为远程仓库有您本地没有的更改。尝试先使用以下命令拉取更改：

```bash
git pull --rebase origin main
```

然后再次尝试推送。

### 凭证问题

如果遇到身份验证问题，请确保您已经设置了正确的GitHub凭证：

```bash
# 设置您的GitHub用户名和邮箱
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

对于密码认证，GitHub现在推荐使用个人访问令牌(PAT)而不是密码。 