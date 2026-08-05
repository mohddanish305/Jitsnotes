# 📚 JITS Notes

A modern and responsive notes platform for **JITS (Jayamukhi Institute of Technological Sciences)** students. Built with **React, Vite, Tailwind CSS, Firebase Hosting, and Supabase** to provide quick access to study materials.

## ✨ Features

- 📖 Browse notes by Year and Subject
- 🔍 Fast and responsive UI
- 📱 Mobile-friendly design
- ⚡ Optimized performance
- 📂 PDF & Google Drive integration
- 🛡️ Secure admin panel
- 💬 Student feedback system
- 📧 Email notifications using EmailJS
- ☁️ Supabase backend
- 🔥 Hosted on Firebase

---

## 🛠️ Tech Stack

- React
- Vite
- Tailwind CSS
- Supabase
- Firebase Hosting
- EmailJS
- Framer Motion

---

## 🚀 Getting Started

### Clone the repository

```bash
git clone https://github.com/mohddanish305/jitsnotes.git
```

```bash
cd jits-notes
```

### Install dependencies

```bash
npm install
```

### Create Environment File

Create a `.env` file in the project root.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ID=your_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
```

### Start Development Server

```bash
npm run dev
```

---

## 📦 Build

```bash
npm run build
```

---

## 🔥 Deploy to Firebase

```bash
firebase deploy
```

or

```bash
firebase deploy --only hosting
```

---

## 📁 Project Structure

```
src/
 ├── components/
 ├── pages/
 ├── lib/
 ├── hooks/
 ├── assets/
 ├── App.jsx
 └── main.jsx
```

---

## 🌐 Live Website

https://jitsnotes.web.app

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a new branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push your branch

```bash
git push origin feature-name
```

5. Open a Pull Request

---

## 🔒 Security

This repository does **NOT** include:

- `.env`
- API Keys
- Secrets
- Firebase credentials

Use your own environment variables before running the project.

---

## 📄 License

This project is available for educational purposes.

---

## 👨‍💻 Developer

**MOHD DANISH**

Made with ❤️ for JITS Students.