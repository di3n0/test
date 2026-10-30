# AICC-Security Portal

企業資安服務入口，使用 **純靜態網站 + NGINX（非 root）+ Kubernetes**。網站提供服務圖片、服務名稱、功能簡介、分類篩選、搜尋與外部跳轉。無資料庫、無後端 API、無登入、無持久儲存需求。

## 專案結構

```text
aicc-security-portal/
├── Dockerfile
├── kustomization.yaml             # K8s 設定與 ConfigMap 生成
├── k8s/
│   ├── namespace.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── dist/
│   ├── index.html                # 網站畫面
│   ├── app.js                    # 讀取 JSON 並產生卡片
│   ├── data/
│   │   └── services.json         # 唯一的服務資料清單，容易擴充
│   └── assets/                   # 圖片，可換成實際平台截圖
└── README.md
```

## 第一次部署到 K8s

1. 在專案根目錄建置容器，並推送到公司可存取的 Registry：

   ```bash
   docker build -t registry.example.com/aicc-security-portal:1.0.0 .
   docker push registry.example.com/aicc-security-portal:1.0.0
   ```

2. 修改根目錄 `kustomization.yaml` 的 `images.newName` 與 `images.newTag`，填入真實 Registry / image tag。私有 Registry 如需 imagePullSecrets，請依公司既有機制加入 `Deployment`。

3. 預覽產生的 K8s 資源，再套用：

   ```bash
   kubectl kustomize .
   kubectl apply -k .
   kubectl -n aicc-security rollout status deployment/aicc-security-portal
   kubectl -n aicc-security get pods,svc
   ```

4. 使用 port-forward 驗證網站（不用先建 Ingress）：

   ```bash
   kubectl -n aicc-security port-forward svc/aicc-security-portal 8080:80
   ```

   瀏覽器開啟 `http://localhost:8080`。

5. 對外發布：`aicc-security-portal.aicc-security.svc.cluster.local:80` 是 **叢集內**的 Service 位址。請由公司現有的 Ingress / Gateway / 反向代理方案接入；如果反向代理在叢集外，不能直接存取 ClusterIP，需使用可到達的內網入口。不另附獨立 Ingress 或 NodePort，以免和公司現有網路衝突。

## 往後新增服務（不需要資料庫、也不用重建網站 image）

只要修改 **`dist/data/services.json`**。例如在 `services` 陣列加上一筆：

```json
{
  "id": "new-service",
  "name": "新的安全服務",
  "category": "risk",
  "subtitle": "安全能力分類",
  "description": "這裡填寫新服務的用途與簡介。",
  "image": "https://your-assets.example.com/new-service.webp",
  "imageAlt": "新服務畫面示意",
  "accent": "#528de9",
  "url": "https://your-service.example.com/",
  "keywords": ["搜尋關鍵字", "資安"]
}
```

- `name`：對使用者顯示的服務名稱（不需揭露底層工具名稱）。
- `category`：服務類別，現有 `risk`、`dev`、`attack`、`intel`；可以在 `categories` 加新類別。未定義的類別仍會自動出現在篩選按鈕。
- `subtitle`：卡片上方的領域標籤。
- `image`：相對路徑 `assets/xxx.svg` 或完整 HTTPS 圖片網址。可用自己的服務截圖。
- `url`：實際平台入口，會在**新分頁**開啟；未設定時只顯示提示，不會導向假網址。
- `accent`：小分類圓點的色彩。
- `keywords`：搜尋用關鍵字。

接著執行：

```bash
kubectl apply -k .
kubectl -n aicc-security rollout status deployment/aicc-security-portal
```

Kustomize 根據 JSON 檔案建立 **帶內容雜湊的 ConfigMap**；變更清單會觸發新的 Deployment rollout。服務卡片數量、首頁數量及分類按鈕會自動依 JSON 更新，**無需重建容器 image**。

> 如果新增圖片是本地檔案 `assets/new.png`，需要放進 `dist/assets/` 並重建/push 容器 image；若圖片放在公司既有可存取的靜態素材 URL，新增服務只需改 JSON。

## 更換內建示意圖片

`dist/assets/` 目前提供六張原創示意 SVG：

| 服務 | 圖片 |
| --- | --- |
| 弱點掃描平台 | `vulnerability-scan.svg` |
| 軟體清單漏洞追蹤平台 | `software-inventory.svg` |
| CI/CD安全掃描平台 | `pipeline-security.svg` |
| AI紅隊平台 | `ai-red-team.svg` |
| Web掃描平台 | `web-security.svg` |
| CVE漏洞情報中心 | `cve-intelligence.svg` |

可替換 SVG 或改成 PNG/JPG/WebP。建議圖片寬高比約 1.95:1。提醒：如果素材是企業內網截圖，請使用能在使用者網路環境載入的圖片 URL。

## 部署架構與資源

```text
Browser
   │
   ▼
公司既有 Ingress / Gateway / Reverse Proxy
   │
   ▼
ClusterIP Service :80
   │
   ▼
2 × NGINX Unprivileged Pods :8080
   │
   ├── dist/                  靜態 HTML、JS、圖片（容器 image）
   └── data/services.json     ConfigMap（read-only）
```

- `replicas: 2`，每個 Pod requests：`25m CPU / 48Mi RAM`；limits：`200m CPU / 128Mi RAM`。
- 無 PVC、PostgreSQL、Redis、MinIO、應用後端、API Server 或外部依賴。
- Pod 非 root、唯讀根檔案系統、停用 ServiceAccount token 自動掛載、drop Linux capabilities。
- 因 K8s ConfigMap 自身不提供權限隔離或資料加密，**不要在 JSON 放 token、帳密或其他秘密**；所有網址僅為前端可見的導覽資訊。

## 靜態網站本機預覽

```bash
python3 -m http.server 8080 --directory dist
```

打開 `http://localhost:8080`。由於服務資料是透過 `fetch()` 載入，不建議直接以 `file://` 雙擊開啟 `index.html`。
