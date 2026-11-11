# S3 Cloud Commander (Ceph & Multi-Endpoint S3 Management)

A full-stack modern web application built with **React.js** (Vite) and **Node.js** (Express) to configure S3 storage boxes, provision IAM / S3 users, manage access credentials, and orchestrate S3 buckets and objects.

---

## 🌟 Features

### 1. Admin Portal ("Manage Boxes")
- **Add Box Configuration**: Add any S3-compatible endpoint (Ceph RadosGW, MinIO, AWS S3).
- **Quick Fill Presets**: Pre-configured with the verified **Ceph Primary Cluster (`10.40.11.155:8000`)**.
- **Real-Time Connectivity Ping**: Live latency and status monitoring (`Online`/`Offline`) with server gateway inspection.
- **Path-Style Addressing & Quotas**: Full support for Ceph IP-based endpoints.

### 2. User Portal ("S3 Workspace & Buckets")
- **IAM User Creation**:
  - Provision S3 user accounts directly via Ceph RadosGW Admin Ops API and AWS SDK.
  - Automatically generates **Access Key ID** and **Secret Access Key**.
  - **Credentials Vault Display**: Shows newly generated keys with show/hide toggle and one-click copy to clipboard.
  - Export credentials as `.env` format or downloadable `.json` keyfile.
- **Bucket Creation**:
  - Dedicated **"Create Bucket"** button triggering an interactive modal popup.
  - Real-time DNS compliance name validation.
  - Instant bucket deployment to the target S3 storage using AWS SDK (`@aws-sdk/client-s3`).
- **Object Explorer & File Upload**:
  - View objects inside any bucket.
  - Upload files directly into the bucket via SDK.
  - Delete objects and buckets.

---

## 🚀 Running the Application

### Backend Server (Express + AWS SDK)
```bash
# Starts backend on http://localhost:5000 (also serves built client)
npm run start
```

### Frontend Client (React + Vite)
```bash
# Starts Vite dev server with hot reload on http://localhost:3000
npm run client
```

### URLs
- **Vite Dev Server**: `http://localhost:3000`
- **Backend API & Production Bundle**: `http://localhost:5000`
