# Synerry Corporation — Developer Examination: Enterprise Short URL & Analytics Platform
## Core Backend API Service (`synerry-shortener-backend`)

บริการประมวลผลหลัก (Core API Service) พัฒนาด้วย Node.js, Express.js, TypeScript และ Prisma ORM ดูแลงานระบบ Authentication (JWT Rotation), URL Management, Base62 Generation, Sub-20ms HTTP 302 Redirection, และ Raw Click Ingestion

---

## ข้อมูลการส่งแบบทดสอบและการเข้าใช้งาน (Submission & Live Testing)

* **URL สำหรับทดสอบระบบออนไลน์**: [https://synerry-shortener.eastasia.cloudapp.azure.com](https://synerry-shortener.eastasia.cloudapp.azure.com)
* **ลิงก์ Repositories ของระบบทั้งหมด (Microservices Architecture)**:
  * **Frontend Repository**: [https://github.com/sangketkit01/synerry-shortener-frontend](https://github.com/sangketkit01/synerry-shortener-frontend)
  * **Core Backend Repository**: [https://github.com/sangketkit01/synerry-shortener-backend](https://github.com/sangketkit01/synerry-shortener-backend)
  * **Analytics Engine Repository**: [https://github.com/sangketkit01/synerry-shortener-analytic](https://github.com/sangketkit01/synerry-shortener-analytic)

### ข้อมูลบัญชีผู้ใช้สำหรับทดสอบ (Test Credentials)

| บทบาท (Role) | อีเมล (Email) | รหัสผ่าน (Password) | สิทธิ์การเข้าถึง |
|---|---|---|---|
| **System Administrator** | `admin@synerry.com` | `Admin@123456` | บริหารจัดการระบบ, ตรวจสอบผู้ใช้, ระงับ/แบนลิงก์, ระงับบัญชีผู้ใช้ และสั่งรัน ETL Pipeline |
| **Standard User** | `demo@synerry.com` | `Demo@123456` | ย่อลิงก์, กำหนด Custom Slug, ตั้งวันหมดอายุ, จัดหมวดหมู่, ดูสถิติกราฟ และ Export CSV |

---

## ตารางสรุปการตอบโจทย์ตามเกณฑ์การตัดสิน (Exam Criteria Compliance)

| ข้อที่ | เกณฑ์การพิจารณาตามโจทย์ | ผลลัพธ์ในระบบ | ฟังก์ชันและการทำงานที่พัฒนา |
|:---:|---|:---:|---|
| **1** | **Data Flow Diagram (DFD Level 0)** | **ผ่านสมบูรณ์** | ออกแบบ DFD Level 0 (Context Diagram) ครอบคลุมการทำงานทั้ง Guest, User, Admin, Visitor และ Data Store ชัดเจน |
| **2** | **Entity-Relationship Diagram (ERD)** | **ผ่านสมบูรณ์** | ออกแบบ ER Diagram แสดงความสัมพันธ์ตารางอย่างครบถ้วน โดยแยกขาดระหว่าง Core OLTP และ Analytics OLAP Star Schema |
| **3** | **สาธิตการสร้าง Short URL ได้** | **ผ่านสมบูรณ์** | กรอก Long URL และสร้าง Short URL ได้จริง รองรับ Base62 Slug และ Custom Alias และคลิกเปิดไปยัง URL ต้นฉบับด้วย HTTP 302 Redirection ในเวลา < 15ms |
| **4** | **สาธิตการสร้าง QR Code ของ Short URL ได้** | **ผ่านสมบูรณ์** | สร้าง QR Code แบบ Real-time Vector สามารถสแกนด้วยกล้องมือถือเพื่อวิ่งไปยัง URL ปลายทางได้จริง พร้อมปรับสีพื้นหน้า/พื้นหลัง และดาวน์โหลดเป็น PNG หรือ SVG |
| **5** | **สาธิตการเก็บประวัติและแสดงสถิติการคลิก** | **ผ่านสมบูรณ์** | มีหน้า Dashboard แสดงรายการประวัติลิงก์ และหน้า Analytics แสดงสถิติการคลิก, กราฟแนวโน้ม 7 วัน, แยกประเภทอุปกรณ์, เว็บบราวเซอร์, ระบบปฏิบัติการ และประเทศ |
| **6** | **ฟังก์ชันเพิ่มเติม / Microservices / Architecture** | **พิจารณาเป็นพิเศษ** | สถาปัตยกรรม Microservices 3 ชั้น, แยกฐานข้อมูล Core OLTP และ Analytics OLAP, ระบบ Data Pipeline (ETL) ป้องกันคอขวด, และระบบรักษาความปลอดภัยบัญชี |

---

## สถาปัตยกรรมระบบ Microservices (Architecture Diagram)

```mermaid
flowchart TD
    subgraph PresentationTier ["Presentation Tier (Next.js 16)"]
        Browser["User Web Browser"]
    end

    subgraph GatewayTier ["Nginx Reverse Proxy & WAF (Port 443 HTTPS)"]
        Nginx["Nginx SSL Let's Encrypt"]
    end

    subgraph ServiceTier ["Microservices Application Tier"]
        FE["Frontend (Next.js 16)\n:3000"]
        BE["Core API (Node.js/Express/TypeScript)\n:5000"]
        AN["Analytics Service (Python/FastAPI)\n:8000"]
    end

    subgraph DataTier ["Dual PostgreSQL 16 Databases"]
        CoreDB[("Core OLTP DB: shorturl_core_db\n(Users, URLs, RawClicks, Sessions)")]
        AnalyticsDB[("OLAP Data Warehouse: shorturl_analytics_db\n(Star Schema: FactClicks, DimTables)")]
    end

    Browser --> Nginx
    Nginx --> FE
    Nginx --> BE
    BE --> AN
    BE --> CoreDB
    CoreDB -.->|"ETL Pipeline Sync (APScheduler / Manual)"| AnalyticsDB
    AN --> AnalyticsDB
```

---

## แผนภาพกระแสข้อมูล: Data Flow Diagram (DFD Level 0)

```mermaid
flowchart TD
    Guest["ผู้ใช้งานทั่วไป (Guest)"]
    Member["สมาชิกในระบบ (Member)"]
    Admin["ผู้ดูแลระบบ (Admin)"]
    Visitor["ผู้คลิกเปิดลิงก์ย่อ (Visitor)"]
    TargetServer["เว็บเซิร์ฟเวอร์ปลายทาง (Target Server)"]

    subgraph SynerryPlatform ["ระบบย่อลิงก์ Synerry Short URL & Analytics Platform"]
        SystemProcess["0.0\nกระบวนการหลักของระบบ\n- จัดการลิงก์ย่อและ QR Code\n- ส่งต่อผู้ใช้ (302 Redirection)\n- บันทึกและวิเคราะห์สถิติ (ETL)\n- บริหารจัดการความปลอดภัย"]
    end

    Guest -->|"1. กรอก URL ต้นฉบับที่ต้องการย่อ"| SystemProcess
    SystemProcess -->|"2. ส่งคืน Short URL และภาพ Vector QR Code"| Guest

    Member -->|"3. เข้าสู่ระบบ, กำหนด Custom Slug, ตั้งวันหมดอายุ,\nจัดหมวดหมู่ และปรับแต่งสี QR Code"| SystemProcess
    SystemProcess -->|"4. รายการประวัติลิงก์, ข้อมูล QR Code และกราฟสถิติการคลิก"| Member

    Visitor -->|"5. ร้องขอเปิดลิงก์ย่อ (/s/:shortCode)\nพร้อมแนบข้อมูล User-Agent, Referrer และ IP"| SystemProcess
    SystemProcess -->|"6. ส่งรหัส HTTP 302 Redirect ไปยังปลายทาง\n(หรือหน้าแจ้งเตือนกรณีลิงก์ถูกแบน/หมดอายุ)"| Visitor
    Visitor -->|"7. บราวเซอร์เปิดหน้าเว็บไซต์ปลายทาง"| TargetServer

    Admin -->|"8. คำสั่งตรวจสอบระบบ, ระงับ/แบนลิงก์, แบนผู้ใช้\nและสั่งรัน Data Pipeline"| SystemProcess
    SystemProcess -->|"9. ข้อมูลสถิติรวมของระบบ, ประวัติการระงับลิงก์\nและสถานะการทำงานของ Data Pipeline"| Admin
```

---

## แผนผังความสัมพันธ์ข้อมูล: Entity-Relationship Diagram (ERD)

### Core Database (OLTP: `shorturl_core_db`)
```mermaid
erDiagram
    User ||--o{ Session : "owns"
    User ||--o{ Group : "creates"
    User ||--o{ Url : "owns"
    User ||--o{ Url : "bans (audit)"
    Group ||--o{ Url : "categorizes"
    Url ||--o{ RawClick : "receives"

    User {
        uuid id PK "รหัสประจำตัวผู้ใช้"
        string email UK "อีเมลผู้ใช้งาน"
        string passwordHash "รหัสผ่านเข้ารหัสด้วย bcrypt"
        string role "สิทธิ์การใช้งาน (USER, ADMIN)"
        boolean isBanned "สถานะการระงับสิทธิ์"
        string banReason "เหตุผลการระงับสิทธิ์"
        datetime bannedAt "เวลาที่ถูกระงับสิทธิ์"
        datetime createdAt "เวลาที่ลงทะเบียน"
        datetime updatedAt "เวลาที่แก้ไขล่าสุด"
    }

    Session {
        uuid id PK "รหัสประจำตัวเซสชัน"
        string tokenHash UK "ค่าแฮชของ Refresh Token (SHA-256)"
        uuid userId FK "เชื่อมโยงไปยัง User"
        string ipAddress "ไอพีแอดเดรสที่เข้าสู่ระบบ"
        string userAgent "เว็บบราวเซอร์ที่เข้าสู่ระบบ"
        datetime expiresAt "เวลาหมดอายุของโทเคน (7 วัน)"
        boolean isRevoked "สถานะการเพิกถอนสิทธิ์"
        datetime createdAt "เวลาที่ออกเซสชัน"
    }

    Group {
        uuid id PK "รหัสประจำตัวกลุ่ม"
        string name "ชื่อกลุ่ม/หมวดหมู่"
        string color "รหัสสีประจำกลุ่ม (Hex Code)"
        uuid userId FK "เจ้าของกลุ่ม เชื่อมโยงไปยัง User"
        datetime createdAt "เวลาที่สร้างกลุ่ม"
        datetime updatedAt "เวลาที่แก้ไขกลุ่ม"
    }

    Url {
        uuid id PK "รหัสประจำตัวลิงก์"
        string originalUrl "URL ปลายทางต้นฉบับ"
        string shortCode UK "รหัสลิงก์ย่อแบบสุ่ม (Base62)"
        string customAlias UK "รหัสลิงก์ย่อแบบกำหนดเอง"
        string title "ชื่อกำกับลิงก์"
        boolean isFavorite "สถานะปักหมุดรายการโปรด"
        boolean isActive "สถานะเปิด/ปิดการใช้งานลิงก์"
        boolean isBanned "สถานะการระงับลิงก์โดยผู้ดูแลระบบ"
        string banReason "เหตุผลการระงับลิงก์"
        datetime bannedAt "เวลาที่ถูกระงับลิงก์"
        uuid bannedById FK "ผู้ระงับลิงก์ เชื่อมโยงไปยัง User"
        datetime expiresAt "วันและเวลาหมดอายุของลิงก์"
        string qrColorDark "สีของตัว QR Code (Hex Code)"
        string qrColorLight "สีพื้นหลังของ QR Code (Hex Code)"
        integer clickCount "ตัวนับจำนวนคลิกสะสม (Fast Read)"
        uuid userId FK "เจ้าของลิงก์ เชื่อมโยงไปยัง User (null สำหรับ Guest)"
        uuid groupId FK "กลุ่มของลิงก์ เชื่อมโยงไปยัง Group (nullable)"
        datetime createdAt "เวลาที่สร้างลิงก์"
        datetime updatedAt "เวลาที่แก้ไขล่าสุด"
    }

    RawClick {
        uuid id PK "รหัสประจำตัวการคลิก"
        uuid urlId FK "ลิงก์ที่ถูกคลิก เชื่อมโยงไปยัง Url"
        string ipAddress "ไอพีแอดเดรสของผู้คลิก"
        string userAgent "User-Agent Header ของผู้คลิก"
        string referrer "หน้าเว็บที่ส่งต่อมา (Referrer Header)"
        boolean isProcessed "สถานะการประมวลผลเข้า Data Warehouse"
        datetime clickedAt "วันและเวลาที่เกิดการคลิก"
    }
```

---

## คู่มือการติดตั้งและเริ่มใช้งานในเครื่อง (Local Installation)

### วิธีที่ 1: รันผ่าน Docker Compose
```bash
cd ..
docker compose up -d
```

### วิธีที่ 2: รันเฉพาะ Backend API
```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. ตั้งค่าไฟล์ .env
cp .env.example .env

# 3. รัน Database Migration และ Seed บัญชีผู้ใช้เริ่มต้น
npx prisma migrate dev
npx ts-node prisma/seed.ts

# 4. เริ่มรัน Backend ในโหมดพัฒนา
npm run dev
# ทำงานที่ http://localhost:5000
```
