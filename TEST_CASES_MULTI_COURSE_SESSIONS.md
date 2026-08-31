# 📋 Test Cases & Specification: AFE Course Architecture & Session Tracking

---

# 🔷 ISSUE 1: Multilingual Course & Lesson Fragmentation Bug
> **"Every lesson in a different language was treated as a completely different lesson, causing progress to disappear on language switch."**

---

## 1. Problem Statement

### The Issue
In `manifest.json`, the localized content for the courses is structured across 14 module definitions (7 languages $\times$ 2 courses), using language-prefixed module IDs (`dct-english-001`, `dct-hindi-001`, `rft-telugu-001`, etc.) and lesson IDs (`dct-en-ch01`, `dct-hi-ch01`, `dct-te-ch01`, etc.).

Previously, student progress (`video_progress`, `quiz_attempts`, `started_modules`) was stored and queried strictly by the literal string `lessonId` and `moduleId`.

### Consequences of the Bug:
1. **Progress Wiped on Language Switch**: If a student completed Chapter 1 in English (`dct-en-ch01`), the database only contained a record for `dct-en-ch01`. When the student changed the dashboard language dropdown to Hindi, the UI queried for `dct-hi-ch01`, found no records, and showed **0% progress**. Switching back to English restored the 5% progress.
2. **False Course Proliferation**: The system treated the application as having 14 distinct, unrelated courses instead of **2 multilingual courses** (*AWS Data Center Tour* and *Robotics Fulfillment Center Tour*).
3. **Inflated/Inaccurate Denominators**: Telemetry and progress calculations either compared progress against all ~200+ lessons across all 7 languages or isolated progress into 14 distinct language silos.

---

## 2. Proposed Solution Overview

1. **Multilingual Parent Course Model**:
   - The application models courses as **canonical parent entities** identified by `courseId` (`'dct'`, `'rft'`, or any future course slug).
2. **Order-Based Dynamic Sibling Resolution (`getSiblingLessonIds`)**:
   - Lessons sharing the same `(courseId, order, type)` across all 7 localized module variants are mapped as **sibling representations of the exact same canonical lesson**.
   - Example: `dct-en-ch01` (Order 1, Video) $\equiv$ `dct-hi-ch01` $\equiv$ `dct-te-ch01` $\equiv$ `dct-gu-ch01` $\equiv$ `dct-mr-ch01` $\equiv$ `dct-kn-ch01` $\equiv$ `dct-ta-ch01`.
3. **Cross-Language Progress Propagation in IPC Layer**:
   - `PROGRESS_GET_VIDEO` queries all sibling IDs and returns the highest completion state.
   - `PROGRESS_GET_ALL_FOR_STUDENT` maps each completed chapter across all its sibling IDs, ensuring the dashboard and module detail views receive full progress regardless of the active language.
   - `QUIZ_GET_BEST_SCORE` & `QUIZ_GET_ATTEMPTS` aggregate scores and attempt histories across equivalent quiz orders in all languages.
4. **Dynamic Course Metadata (`getCourseMetadata`)**:
   - Denominators are computed dynamically from distinct `order` numbers in the manifest (14 videos + 6 quizzes = 20 total items for DCT; 14 videos + 9 quizzes = 23 total items for RFT).

---

## 3. Unit Test Cases (Issue 1)

### Test Case 1.1: Video Completion Preserved Across Language Switch
* **Precondition**: Student logs in with language set to **English**. DCT progress is currently 0%.
* **Action**:
  1. Student opens **AWS Data Center Tour (DCT)** in English.
  2. Student watches Chapter 1 Video (`dct-en-ch01`) to 100% completion.
  3. Student returns to Dashboard $\rightarrow$ DCT card displays **5%** (1/20 items).
  4. Student switches the language dropdown from **English** to **Hindi**.
* **Expected Result**:
  * On the Hindi dashboard, the DCT card **retains 5% progress** (does NOT reset to 0%).
  * Student opens DCT in Hindi $\rightarrow$ Chapter 1 Video (`dct-hi-ch01`) displays with a **completed green checkmark**.
  * Opening the video player for `dct-hi-ch01` recognizes it as already completed.

---

### Test Case 1.2: Quiz Attempt & Best Score Shared Across Languages
* **Precondition**: Student has completed Chapter 1 Video. Active language is **Hindi**.
* **Action**:
  1. In Hindi DCT, student attempts Chapter 2 Quiz (`dct-hi-ch02-quiz`) and scores **4/5 (80%)**.
  2. Student switches language dropdown to **Tamil**.
  3. Student navigates to Tamil DCT and views Chapter 2 Quiz (`dct-ta-ch02-quiz`).
* **Expected Result**:
  * In Tamil DCT, Chapter 2 Quiz displays as completed with score **4/5 (80%)**.
  * Total course progress on the Tamil dashboard includes the quiz completion.

---

### Test Case 1.3: Alternating Languages within the Same Course
* **Precondition**: Student starts a fresh DCT course (0% progress).
* **Action**:
  1. In **English**, student watches Chapter 1 Video (Order 1).
  2. Student switches to **Telugu** and watches Chapter 2 Video (Order 2).
  3. Student switches to **Marathi** and takes Chapter 2 Quiz (Order 3, score: 5/5).
* **Expected Result**:
  * Total completed videos for DCT = `2` (Orders 1 and 2).
  * Total completed quizzes for DCT = `1` (Order 3).
  * Total completed items = `3/20` $\rightarrow$ **15% completion** shown consistently across all 7 languages.
  * No duplicate counts or fragmented progress records.

---

### Test Case 1.4: "Module Started" Status Shared Across Languages
* **Precondition**: Student has never opened Robotics Fulfillment Center Tour (RFT).
* **Action**:
  1. In **Gujarati**, student clicks and opens RFT (`rft-gujarati-001`).
  2. Student navigates back to dashboard and switches language to **Kannada**.
* **Expected Result**:
  * `ipc.getStartedModules()` returns all sibling module IDs for RFT.
  * In Kannada, RFT shows as "In Progress / Started" rather than "Not Started".

---

## 4. Edge Cases (Issue 1)

### Edge Case 1.1: Re-watching in a Different Language with Higher Progress
* **Scenario**: Student watched 85% of Chapter 1 in English, then opens Chapter 1 in Hindi and watches to 100%.
* **Action**: Hindi video player updates progress to 100%.
* **Expected Result**:
  * Progress across all sibling lesson IDs (`dct-en-ch01`, `dct-hi-ch01`, etc.) updates to `100%` and `completed: true`.

---

### Edge Case 1.2: Re-taking a Quiz in a Different Language with a Better Score
* **Scenario**: Student scored 3/5 (60%) on `dct-en-ch02-quiz`, then switches to Hindi and scores 5/5 (100%) on `dct-hi-ch02-quiz`.
* **Action**: Submit second quiz attempt in Hindi.
* **Expected Result**:
  * `ipc.getBestQuizScore(studentId, 'dct-en-ch02-quiz')` returns **5** (the highest score across all language attempts for Order 2).
  * `ipc.getQuizAttempts()` returns both attempt records sorted by timestamp.

---

### Edge Case 1.3: Rapid Language Toggling on Dashboard
* **Scenario**: Student rapidly clicks English $\rightarrow$ Hindi $\rightarrow$ Tamil $\rightarrow$ Telugu on the dashboard.
* **Action**: Fast consecutive language state changes.
* **Expected Result**:
  * UI titles and descriptions translate instantly without lag or flashing 0% progress bars.
  * Progress percentage remains strictly stable throughout all transitions.

---
---

# 🔷 ISSUE 2: Multi-Course Single-Session Coalescing Bug
> **"The sessions, currently, are being polled to server as a single session, even if the student watches videos with both courses."**

---

## 1. Problem Statement

### The Issue
When a student logged in and engaged with multiple different courses (e.g., watched Chapter 1 of **AWS Data Center Tour (DCT)** and Chapter 2 of **Robotics Fulfillment Center Tour (RFT)** during the same login window), the telemetry system compiled only a **single monolithic session row**.

### Consequences of the Bug:
1. **Module & Telemetry Overwrite**: The single session row reported only one module ID (e.g., `moduleId: 'dct'`), discarding all analytics and proof of engagement for `rft`.
2. **Distorted Completion Denominators**: Watch times and quiz scores across different courses were lumped together, computing meaningless completion percentages.
3. **RMS Server Sync Pollution**: Central analytics could not track which specific courses students were completing or divide hours accurately per tour.

---

## 2. Proposed Solution Overview

1. **Course-Scoped Engagement Identification**:
   - `SessionManager.endSession()` identifies all distinct canonical courses (`engagedCourseIds`) that the student interacted with during the session.
2. **One Session Record per Engaged Course**:
   - If a student interacts with $N$ courses ($N \ge 1$), the system saves **$N$ distinct session rows** in `afe_sessions`.
3. **Sequential Session IDs**:
   - Each session row receives a unique sequential session ID (`..._INDIV_001`, `..._INDIV_002`) sharing the same timestamp window.
4. **Isolated Metrics & Dynamic Denominators**:
   - Duration is split evenly across engaged courses (minimum 1 minute each).
   - Video completion rate, quiz accuracy, completed video count, and overall percentage are calculated strictly against that specific course's dynamic denominator (`getCourseMetadata()`).
5. **Standardized Sync Payload**:
   - Every session record syncs to RMS with `unitType: 'Modular AFE'`, `tourType: 'Virtual'`, `moduleId: '<course_slug>'`, `moduleName: '<Course Title>'`, and `language: '<Session Language>'`.

---

## 3. Unit Test Cases (Issue 2)

### Test Case 2.1: Single Course Engagement (DCT Only)
* **Precondition**: Student logs in with language set to English.
* **Action**:
  1. Student opens **AWS Data Center Tour (DCT)**.
  2. Student watches Chapter 1 Video (100%) and completes Chapter 1 Quiz (score: 5/5).
  3. Student ends the session.
* **Expected Result**:
  * Exactly **1 session row** is created in `afe_sessions`.
  * `moduleId`: `'dct'`
  * `moduleName`: `'AWS Data Center Tour: Uncovering Cloud Computing'`
  * `tourType`: `'Virtual'`
  * `videosCompletedCount`: `1` (out of 14 total DCT videos)
  * `quizzesCompletedCount`: `1` (out of 6 total DCT quizzes)
  * `completionPercentage`: `10%` (2/20 items)
  * `quizAccuracyPercentage`: `100.00%`

---

### Test Case 2.2: Multi-Course Engagement in Single Session (DCT + RFT)
* **Precondition**: Student logs in with language set to English.
* **Action**:
  1. Student opens **AWS Data Center Tour (DCT)** and watches Chapter 1 Video for 3 minutes.
  2. Student returns to Dashboard, opens **Robotics Fulfillment Center Tour (RFT)**, and watches Chapter 1 Video for 4 minutes.
  3. Total session duration is 8 minutes.
  4. Student ends the session.
* **Expected Result**:
  * Exactly **2 distinct session rows** are generated:
    * **Row 1 (DCT)**:
      * `sessionId`: Ends in `_INDIV_001`
      * `moduleId`: `'dct'`
      * `moduleName`: `'AWS Data Center Tour: Uncovering Cloud Computing'`
      * `durationMinutes`: `4` (half of 8 minutes)
      * `totalWatchTimeSeconds`: `180`
      * `videosCompletedCount`: `1`
      * `videoCompletionRate`: `7.14%` (1/14 videos)
    * **Row 2 (RFT)**:
      * `sessionId`: Ends in `_INDIV_002`
      * `moduleId`: `'rft'`
      * `moduleName`: `'Robotics Fulfillment Center Tour'`
      * `durationMinutes`: `4` (half of 8 minutes)
      * `totalWatchTimeSeconds`: `240`
      * `videosCompletedCount`: `1`
      * `videoCompletionRate`: `7.14%` (1/14 videos)
  * Both rows have `synced: false` and sync to RMS as 2 independent records.

---

### Test Case 2.3: Quiz in Course A + Video Watch in Course B
* **Precondition**: Student has an active login session.
* **Action**:
  1. Student navigates to DCT and completes Chapter 2 Quiz (total questions: 5, score: 4). No DCT video watched.
  2. Student navigates to RFT and watches Chapter 3 Video (duration: 120s, 100%). No RFT quiz taken.
  3. Student ends session.
* **Expected Result**:
  * **Row 1 (DCT)**:
    * `moduleId`: `'dct'`
    * `totalWatchTimeSeconds`: `0`
    * `videosCompletedCount`: `0`
    * `quizzesCompletedCount`: `1`
    * `quizAccuracyPercentage`: `80.00%`
  * **Row 2 (RFT)**:
    * `moduleId`: `'rft'`
    * `totalWatchTimeSeconds`: `120`
    * `videosCompletedCount`: `1`
    * `quizzesCompletedCount`: `0`
    * `quizAccuracyPercentage`: `0.00%`

---

## 4. Edge Cases (Issue 2)

### Edge Case 2.1: Passive Session (Zero Video Watch & Zero Quiz Attempts)
* **Scenario**: Student logs in, chats briefly with AI Tutor on the dashboard, and logs out without opening any video or quiz.
* **Action**: Start session $\rightarrow$ end session after 2 minutes with no lesson interaction.
* **Expected Result**:
  * Exactly **1 fallback session row** is created for the default course (`moduleId: 'dct'`).
  * `durationMinutes`: `2`, `totalWatchTimeSeconds`: `0`, `videosCompletedCount`: `0`, `quizzesCompletedCount`: `0`.
  * No crash, no null pointer exceptions.

---

### Edge Case 2.2: Very Short Session (< 1 Minute Duration)
* **Scenario**: Student logs in and immediately logs out within 15 seconds.
* **Action**: Start session $\rightarrow$ wait 15 seconds $\rightarrow$ end session.
* **Expected Result**:
  * Session row is saved with `durationMinutes: 1` (clamped to minimum 1 minute to satisfy server validation rules).
  * Timestamps `startTime` and `endTime` reflect the exact 15-second difference in ISO format.

---

### Edge Case 2.3: Rapid Course Switching (< 5 Seconds Preview Without Progress)
* **Scenario**: Student opens DCT, stays for 2 seconds, goes back, opens RFT, stays for 3 seconds, then watches an RFT video.
* **Action**: Fast navigation between module views.
* **Expected Result**:
  * DCT is not falsely marked as an engaged course since no watch duration (>0s) or quiz attempt was recorded.
  * Only **1 session row** for `'rft'` is emitted.

---

### Edge Case 2.4: High Daily Session Count Sequence (Sequential ID Roll)
* **Scenario**: Student logs in for their 10th session of the day on the same device and completes activities across 2 courses.
* **Action**: `getSessionCountForDate()` returns `9`.
* **Expected Result**:
  * Row 1 (Course 1) ID: `CT_IN_YYYYMMDD_<UDISE>_<GRADE>_INDIV_010`
  * Row 2 (Course 2) ID: `CT_IN_YYYYMMDD_<UDISE>_<GRADE>_INDIV_011`
  * Zero collision with existing IDs in `afe_sessions`.

---

### Edge Case 2.5: Future Third Course Added to Manifest (e.g. "Music Tour")
* **Scenario**: A new course `music` is added to `manifest.json` with 10 videos and 5 quizzes.
* **Action**: Student watches 1 DCT video, 1 RFT video, and 1 Music video in a single session.
* **Expected Result**:
  * Exactly **3 session rows** are generated (`_INDIV_001`, `_INDIV_002`, `_INDIV_003`).
  * Row 1: `moduleId: 'dct'`, denominator = 14 videos + 6 quizzes.
  * Row 2: `moduleId: 'rft'`, denominator = 14 videos + 9 quizzes.
  * Row 3: `moduleId: 'music'`, denominator = 10 videos + 5 quizzes (`videoCompletionRate: 10.00%`, `completionPercentage: 7%`).
  * Extensible design handles the new course automatically without code changes.
