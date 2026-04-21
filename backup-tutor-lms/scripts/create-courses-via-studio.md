# Creating Mars Ed Courses in Open edX Studio

Since Open edX course import requires OLX format (zip files), the fastest way
to get started is to create courses manually in Studio, then paste in the content.

## Step 1: Access Studio

Go to: http://studio.marsgeo.io (or http://localhost:8001)
Log in with your admin credentials.

---

## Step 2: Create Course 1 — Physical AI Foundations

1. Click **"New Course"**
2. Fill in:
   - **Course Name:** Physical AI Foundations
   - **Organization:** MarsEd
   - **Course Number:** PAI101
   - **Course Run:** 2025
3. Click **"Create"**

### Add Sections (Modules)

In the course outline, click **"+ New Section"** for each module:

1. What Is Physical AI?
2. Robot Fundamentals
3. Simulation Environments
4. Teleoperation
5. Dataset Engineering
6. Policy Learning
7. VLM & VLA Models
8. Sim-to-Real & The Full Loop

### For each section, add a Subsection, then add:
- **HTML component** — paste content from `lms/courses/course1-physical-ai-foundations/html/module*.html`
- **Video component** — paste YouTube URL
- **Problem component** — paste quiz XML from `lms/courses/course1-physical-ai-foundations/problem/module*-quiz.xml`

---

## Step 3: Create Course 2 — TeleOp Controller Certification

1. Click **"New Course"**
2. Fill in:
   - **Course Name:** TeleOp Controller Certification
   - **Organization:** MarsEd
   - **Course Number:** CTRL101
   - **Course Run:** 2025

### Sections:
1. Your Job in Physical AI
2. Getting Around the Platform
3. Connecting to a Robot
4. Drive Controls
5. Arm & Manipulator Controls
6. Voice Controls
7. Watching & Monitoring
8. Recording a Session
9. Safety & Good Habits
10. Finding Work on TeleOp Hub

Content: `lms/courses/course2-teleop-controller/html/all-modules.html`
(Split by `<section id="moduleN">` tags)

---

## Step 4: Create Course 3 — TeleOp Trainer Certification

1. Click **"New Course"**
2. Fill in:
   - **Course Name:** TeleOp Trainer Certification
   - **Organization:** MarsEd
   - **Course Number:** TRNR101
   - **Course Run:** 2025

### Sections:
1. From Operator to Trainer
2. Designing a Collection Session
3. Telemetry Data
4. Video Data Quality
5. Audio & Language Pairing
6. Data Curation
7. Data Labeling
8. Simulation for Data Generation
9. Configuring VLA & VLM Models
10. Managing Data Collection Jobs
11. The Iteration Loop

Content: `lms/courses/course3-teleop-trainer/html/all-modules.html`

---

## Step 5: Configure Certificates

For each course:
1. Go to **Settings → Certificates**
2. Enable certificates
3. Set passing grade: 70%
4. Add certificate signatories:
   - Name: MarsGeo Robotics University
   - Title: Physical AI Education Program

---

## Step 6: Publish

For each course:
1. Go to **Settings → Schedule & Details**
2. Set enrollment open date
3. Click **"Publish"** in the course outline

---

## Theme: Indigo (Best Modern Look)

```bash
# Apply the Indigo theme (modern, clean, dark-friendly)
tutor local do settheme indigo

# Restart to apply
tutor local restart
```

The Indigo theme gives Open edX a modern, professional look with:
- Clean card-based course catalog
- Progress indicators
- Mobile-responsive layout
- Dark mode support
