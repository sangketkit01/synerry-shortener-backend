# Core Backend API Service (`synerry-shortener-backend`)

บริการประมวลผลหลัก (Core API Service) พัฒนาด้วย Node.js, Express.js, TypeScript และ Prisma ORM สำหรับระบบ Synerry Short URL

---

## 1. ข้อมูลการทดสอบออนไลน์ (Live Demo & Credentials)

* **URL ทดสอบระบบออนไลน์**: [https://synerry-shortener.eastasia.cloudapp.azure.com](https://synerry-shortener.eastasia.cloudapp.azure.com)
* **Administrator**: `admin@synerry.com` / `Admin@123456`
* **Standard User**: `demo@synerry.com` / `Demo@123456`

---

## 2. ลิงก์ Repositories ที่เกี่ยวข้อง (Microservices)

* **Frontend**: [https://github.com/sangketkit01/synerry-shortener-frontend](https://github.com/sangketkit01/synerry-shortener-frontend)
* **Backend API**: [https://github.com/sangketkit01/synerry-shortener-backend](https://github.com/sangketkit01/synerry-shortener-backend)
* **Analytics Engine**: [https://github.com/sangketkit01/synerry-shortener-analytic](https://github.com/sangketkit01/synerry-shortener-analytic)

---

## 3. วิธีการติดตั้งและเริ่มใช้งาน (Installation & Setup)

### ข้อกำหนดของระบบ (Prerequisites)
* Node.js v18 ขึ้นไป และ npm
* PostgreSQL v14 ขึ้นไป (พอร์ต 5432)

### ขั้นตอนการรัน

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. ตั้งค่าไฟล์ Environment Variables
cp .env.example .env

# 3. เตรียมฐานข้อมูลและสร้างตาราง (Prisma Migration & Seed)
npx prisma migrate dev
npx ts-node prisma/seed.ts

# 4. เริ่มรันเซิร์ฟเวอร์ในโหมดพัฒนา
npm run dev
```

เซิร์ฟเวอร์จะเริ่มทำงานที่: `http://localhost:5000`

---

## 4. สคริปต์คำสั่งที่มีให้ใช้งาน (Available Scripts)

* `npm run dev`: รันในโหมดพัฒนาด้วย `tsx watch`
* `npm run build`: คอมไพล์ TypeScript ด้วย `tsc`
* `npm start`: รันเซิร์ฟเวอร์ระดับ Production จากโฟลเดอร์ `dist/`
