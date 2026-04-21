#!/usr/bin/env python3
"""
generate-olx.py — Generates Open edX OLX course packages from Mars Ed content.

Usage:
  python3 generate-olx.py <course_id> <output_dir> <content_dir>

OLX structure:
  course/
    course.xml
    chapter/          ← sections (modules)
      module1.xml
    sequential/       ← subsections
      module1.xml
    vertical/         ← units
      module1.xml
    html/             ← HTML content blocks
      module1.xml
    problem/          ← Quiz blocks
      module1.xml
    video/            ← Video blocks
      module1.xml
    about/
      overview.html
    policies/
      course/
        policy.json
        grading_policy.json
"""

import os
import sys
import json
import shutil
import re
from pathlib import Path

# ── Course definitions ─────────────────────────────────────────────────────

COURSES = {
    "course1-physical-ai-foundations": {
        "org": "MarsEd",
        "number": "PAI101",
        "run": "2025",
        "display_name": "Physical AI Foundations",
        "short_description": "From simulator to AI-controlled robot — the complete pipeline.",
        "start": "2025-01-01T00:00:00Z",
        "modules": [
            {
                "id": "m1",
                "title": "What Is Physical AI?",
                "html_file": "module1-what-is-physical-ai.html",
                "video_url": "https://www.youtube.com/watch?v=ZR3GIwCFMpQ",
                "quiz_file": "module1-quiz.xml",
            },
            {
                "id": "m2",
                "title": "Robot Fundamentals",
                "html_file": "module2-robot-fundamentals.html",
                "video_url": "https://www.youtube.com/watch?v=ZR3GIwCFMpQ",
                "quiz_file": None,
            },
            {
                "id": "m3",
                "title": "Simulation Environments",
                "html_file": "module3-simulation.html",
                "video_url": "https://www.youtube.com/watch?v=0ORsj_E17B0",
                "quiz_file": None,
            },
            {
                "id": "m4",
                "title": "Teleoperation",
                "html_file": "module4-teleoperation.html",
                "video_url": "https://www.youtube.com/watch?v=1nR7GCE1oFU",
                "quiz_file": None,
            },
            {
                "id": "m5",
                "title": "Dataset Engineering",
                "html_file": "module5-dataset-engineering.html",
                "video_url": "https://www.youtube.com/watch?v=1nR7GCE1oFU",
                "quiz_file": None,
            },
            {
                "id": "m6",
                "title": "Policy Learning",
                "html_file": "module6-policy-learning.html",
                "video_url": "https://www.youtube.com/watch?v=1nR7GCE1oFU",
                "quiz_file": None,
            },
            {
                "id": "m7",
                "title": "VLM & VLA Models",
                "html_file": "module7-vlm-vla.html",
                "video_url": "https://www.youtube.com/watch?v=ZR3GIwCFMpQ",
                "quiz_file": None,
            },
            {
                "id": "m8",
                "title": "Sim-to-Real & The Full Loop",
                "html_file": "module8-sim-to-real.html",
                "video_url": "https://www.youtube.com/watch?v=ZR3GIwCFMpQ",
                "quiz_file": None,
            },
        ],
    },

    "course2-teleop-controller": {
        "org": "MarsEd",
        "number": "CTRL101",
        "run": "2025",
        "display_name": "TeleOp Controller Certification",
        "short_description": "Learn to control robots. Get certified. Get hired.",
        "start": "2025-01-01T00:00:00Z",
        "modules": [
            {"id": "m1",  "title": "Your Job in Physical AI",        "section_id": "module1",  "video_url": "https://www.youtube.com/watch?v=7-4_9-j-2_M"},
            {"id": "m2",  "title": "Getting Around the Platform",    "section_id": "module2",  "video_url": None},
            {"id": "m3",  "title": "Connecting to a Robot",          "section_id": "module3",  "video_url": None},
            {"id": "m4",  "title": "Drive Controls",                 "section_id": "module4",  "video_url": None},
            {"id": "m5",  "title": "Arm & Manipulator Controls",     "section_id": "module5",  "video_url": None},
            {"id": "m6",  "title": "Voice Controls",                 "section_id": "module6",  "video_url": None},
            {"id": "m7",  "title": "Watching & Monitoring",          "section_id": "module7",  "video_url": None},
            {"id": "m8",  "title": "Recording a Session",            "section_id": "module8",  "video_url": None},
            {"id": "m9",  "title": "Safety & Good Habits",           "section_id": "module9",  "video_url": None},
            {"id": "m10", "title": "Finding Work on TeleOp Hub",     "section_id": "module10", "video_url": None},
        ],
        "combined_html": "all-modules.html",
        "final_quiz": "final-quiz.xml",
    },

    "course3-teleop-trainer": {
        "org": "MarsEd",
        "number": "TRNR101",
        "run": "2025",
        "display_name": "TeleOp Trainer Certification",
        "short_description": "Collect better data. Train better robots.",
        "start": "2025-01-01T00:00:00Z",
        "modules": [
            {"id": "m1",  "title": "From Operator to Trainer",           "section_id": "module1"},
            {"id": "m2",  "title": "Designing a Data Collection Session", "section_id": "module2"},
            {"id": "m3",  "title": "Telemetry Data",                     "section_id": "module3"},
            {"id": "m4",  "title": "Video Data Quality",                 "section_id": "module4"},
            {"id": "m5",  "title": "Audio & Language Pairing",           "section_id": "module5"},
            {"id": "m6",  "title": "Data Curation",                      "section_id": "module6"},
            {"id": "m7",  "title": "Data Labeling",                      "section_id": "module7"},
            {"id": "m8",  "title": "Simulation for Data Generation",     "section_id": "module8"},
            {"id": "m9",  "title": "Configuring VLA & VLM Models",       "section_id": "module9"},
            {"id": "m10", "title": "Managing Data Collection Jobs",      "section_id": "module10"},
            {"id": "m11", "title": "The Iteration Loop",                 "section_id": "module11"},
        ],
        "combined_html_files": ["modules-1-6.html", "modules-7-11.html"],
        "final_quiz": "final-quiz.xml",
    },
}


def extract_section(html_content: str, section_id: str) -> str:
    """Extract a <section id="moduleN">...</section> block from combined HTML."""
    pattern = rf'<section id="{section_id}">(.*?)</section>'
    match = re.search(pattern, html_content, re.DOTALL)
    if match:
        return match.group(1).strip()
    # Fallback: return full content
    return html_content


def write_xml(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def build_course(course_id: str, output_dir: str, content_dir: str):
    cfg = COURSES[course_id]
    org = cfg["org"]
    number = cfg["number"]
    run = cfg["run"]
    course_key = f"{org}+{number}+{run}"

    out = Path(output_dir) / course_id
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    content = Path(content_dir)

    # ── course.xml (root pointer) ─────────────────────────────────────────
    # Open edX import expects a root course.xml that points to the run
    root_course_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<course url_name="{run}" org="{org}" course="{number}"/>
"""
    write_xml(out / "course.xml", root_course_xml)

    # ── course/<run>.xml (full course definition) ─────────────────────────
    chapter_refs = "\n  ".join(
        f'<chapter url_name="{m["id"]}"/>' for m in cfg["modules"]
    )
    course_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<course
  display_name="{cfg['display_name']}"
  start="{cfg['start']}"
  language="en"
  cert_html_view_enabled="true"
  certificates_display_behavior="end"
  self_paced="true"
>
  {chapter_refs}
</course>
"""
    write_xml(out / "course" / f"{run}.xml", course_xml)

    # ── about/overview.html ───────────────────────────────────────────────
    overview_src = content / "about" / "overview.html"
    (out / "about").mkdir(parents=True, exist_ok=True)
    if overview_src.exists():
        shutil.copy(overview_src, out / "about" / "overview.html")
    else:
        (out / "about").mkdir(parents=True, exist_ok=True)
        (out / "about" / "overview.html").write_text(
            f"<p>{cfg['short_description']}</p>", encoding="utf-8"
        )

    # ── policies ──────────────────────────────────────────────────────────
    policy = {
        "course/2025": {
            "display_name": cfg["display_name"],
            "start": cfg["start"],
            "enrollment_start": cfg["start"],
            "cert_html_view_enabled": True,
            "certificates_display_behavior": "end",
            "self_paced": True,
        }
    }
    grading = {
        "GRADER": [
            {
                "type": "Quiz",
                "min_count": 1,
                "drop_count": 0,
                "short_label": "Quiz",
                "weight": 1.0,
            }
        ],
        "GRADE_CUTOFFS": {"Pass": 0.70},
    }
    policies_dir = out / "policies" / "course"
    policies_dir.mkdir(parents=True)
    (policies_dir / "policy.json").write_text(json.dumps(policy, indent=2))
    (policies_dir / "grading_policy.json").write_text(json.dumps(grading, indent=2))

    # ── Load combined HTML if needed ──────────────────────────────────────
    combined_html = ""
    if "combined_html" in cfg:
        html_path = content / "html" / cfg["combined_html"]
        if html_path.exists():
            combined_html = html_path.read_text(encoding="utf-8")
    elif "combined_html_files" in cfg:
        for fname in cfg["combined_html_files"]:
            html_path = content / "html" / fname
            if html_path.exists():
                combined_html += html_path.read_text(encoding="utf-8")

    # ── Load final quiz ───────────────────────────────────────────────────
    final_quiz_xml = None
    if "final_quiz" in cfg:
        quiz_path = content / "problem" / cfg["final_quiz"]
        if quiz_path.exists():
            final_quiz_xml = quiz_path.read_text(encoding="utf-8")

    # ── Build modules ─────────────────────────────────────────────────────
    for i, mod in enumerate(cfg["modules"]):
        mid = mod["id"]
        title = mod["title"]
        is_last = (i == len(cfg["modules"]) - 1)

        # chapter (section)
        seq_ref = f'<sequential url_name="{mid}_seq"/>'
        chapter_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<chapter display_name="{title}">
  {seq_ref}
</chapter>
"""
        write_xml(out / "chapter" / f"{mid}.xml", chapter_xml)

        # sequential (subsection)
        vert_ref = f'<vertical url_name="{mid}_vert"/>'
        seq_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<sequential display_name="{title}" graded="false">
  {vert_ref}
</sequential>
"""
        write_xml(out / "sequential" / f"{mid}_seq.xml", seq_xml)

        # Determine HTML content
        if "html_file" in mod:
            # Course 1: individual HTML files
            html_src = content / "html" / mod["html_file"]
            html_body = html_src.read_text(encoding="utf-8") if html_src.exists() else f"<p>{title}</p>"
        elif "section_id" in mod and combined_html:
            # Course 2 & 3: extract section from combined HTML
            html_body = extract_section(combined_html, mod["section_id"])
        else:
            html_body = f"<h2>{title}</h2><p>Content coming soon.</p>"

        # HTML block
        html_block_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<html display_name="{title}" filename="{mid}_content"/>
"""
        write_xml(out / "html" / f"{mid}.xml", html_block_xml)
        write_xml(out / "html" / f"{mid}_content.html", html_body)

        # Video block (if URL provided)
        video_url = mod.get("video_url")
        video_ref = ""
        if video_url:
            # Extract YouTube ID
            yt_match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", video_url)
            yt_id = yt_match.group(1) if yt_match else ""
            video_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<video
  display_name="Module Video"
  youtube_id_1_0="{yt_id}"
  youtube="1.00:{yt_id}"
  download_video="false"
  show_captions="true"
/>
"""
            write_xml(out / "video" / f"{mid}_video.xml", video_xml)
            video_ref = f'<video url_name="{mid}_video"/>'

        # Quiz block
        quiz_ref = ""
        quiz_xml_content = None

        if "quiz_file" in mod and mod["quiz_file"]:
            quiz_src = content / "problem" / mod["quiz_file"]
            if quiz_src.exists():
                quiz_xml_content = quiz_src.read_text(encoding="utf-8")
        elif is_last and final_quiz_xml:
            quiz_xml_content = final_quiz_xml

        if quiz_xml_content:
            write_xml(out / "problem" / f"{mid}_quiz.xml", quiz_xml_content)
            quiz_ref = f'<problem url_name="{mid}_quiz"/>'

        # vertical (unit) — contains html + video + quiz
        unit_children = f"""  <html url_name="{mid}"/>
  {video_ref}
  {quiz_ref}"""
        vert_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<vertical display_name="{title}">
{unit_children}
</vertical>
"""
        write_xml(out / "vertical" / f"{mid}_vert.xml", vert_xml)

    print(f"    ✅ OLX built: {out}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: generate-olx.py <course_id> <output_dir> <content_dir>")
        sys.exit(1)

    course_id = sys.argv[1]
    output_dir = sys.argv[2]
    content_dir = sys.argv[3]

    if course_id not in COURSES:
        print(f"Unknown course: {course_id}")
        print(f"Available: {list(COURSES.keys())}")
        sys.exit(1)

    build_course(course_id, output_dir, content_dir)
