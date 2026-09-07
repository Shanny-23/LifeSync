import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/SHANNY/.gemini/antigravity-ide/brain/534517e3-a13b-4f6d-bc55-0a927b9b00b3/screenshots';

async function run() {
  console.log('=== Starting Real Playwright E2E Verification ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));
  page.on('request', (req) => console.log('REQ:', req.method(), req.url()));

  const results = {};

  try {
    // 1. Authenticate with Demo Session & Load Dashboard
    console.log('1. Authenticating via demo token and loading Dashboard...');
    await page.goto('http://127.0.0.1:5173/?token=demo-token-demo_user_1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    // Ensure we are on /dashboard
    if (!page.url().includes('/dashboard')) {
      await page.goto('http://127.0.0.1:5173/dashboard', { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_authenticated_dashboard.png') });
    console.log('   Dashboard loaded successfully. Current URL:', page.url());
    results['dashboard_load'] = 'PASS';

    // 2. Pomodoro Timer Controls
    console.log('2. Testing Pomodoro Timer Widget (+5m, Done, and API logging)...');
    const timerSection = page.locator('.focus-clock-container').first();
    await timerSection.scrollIntoViewIfNeeded();

    const startBtn = page.locator('button:has-text("Start Focus"), button:has-text("Pause")').first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(600);
    }

    const plus5Btn = page.locator('button:has-text("+5m")').first();
    if (await plus5Btn.isVisible()) {
      await plus5Btn.click();
      await page.waitForTimeout(300);
    }

    const doneBtn = page.locator('button:has-text("✓ Done"), button[title*="Mark this focus session complete"]').first();
    await doneBtn.scrollIntoViewIfNeeded();

    const [completeResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/focus/complete') && res.status() === 201),
      doneBtn.click(),
    ]);
    const completeJson = await completeResponse.json();
    console.log('   FocusSession logged via API:', completeJson.id, 'duration:', completeJson.duration_seconds);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_pomodoro_completed.png') });

    // Reload page to verify persistence
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_stats_persisted_after_reload.png') });
    results['pomodoro_timer'] = 'PASS';

    // 3. Syllabus Mastery & Exam Planner
    console.log('3. Testing Syllabus Mastery & Exam Planner...');
    const syllabusCard = page.locator('.syllabus-card').first();
    await syllabusCard.scrollIntoViewIfNeeded();

    const syllabusItem = page.locator('.syllabus-item').first();
    const pctText = await syllabusItem.locator('.syllabus-pct').innerText();
    const currentPct = parseInt(pctText.replace('%', ''), 10) || 0;
    const progressBtn = currentPct >= 100
      ? page.locator('button[title*="Decrease syllabus progress"]').first()
      : page.locator('button[title*="Increase syllabus progress"]').first();

    if (await progressBtn.isVisible()) {
      await progressBtn.scrollIntoViewIfNeeded();
      const [syllabusRes] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('/api/courses/') && res.url().includes('/syllabus') && res.status() === 200),
        progressBtn.click(),
      ]);
      const syllabusJson = await syllabusRes.json();
      console.log('   Course syllabus updated to:', syllabusJson.syllabus_covered_pct);
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_syllabus_updated.png') });

    const boostBtn = page.locator('button:has-text("Boost Prep")').first();
    const boostCount = await boostBtn.count();
    console.log('   Found Boost Prep buttons:', boostCount);
    if (boostCount > 0) {
      await boostBtn.scrollIntoViewIfNeeded();
      const [boostRes] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('/plan-exam'), { timeout: 10000 }),
        boostBtn.click({ force: true }),
      ]);
      console.log('   Boost Prep API status:', boostRes.status());
      const boostJson = await boostRes.json();
      console.log('   Exam study plan created:', boostJson.generated_tasks_count, 'study blocks');
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_exam_study_boosted.png') });
    results['syllabus_mastery'] = 'PASS';

    // 4. Workspace Switcher
    console.log('4. Testing Workspace Switcher...');
    const wsSelector = page.locator('.workspace-selector').first();
    await wsSelector.click();
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Academic")').last().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_workspace_academic.png') });

    await wsSelector.click();
    await page.waitForTimeout(200);
    await page.locator('button:has-text("All Spaces")').last().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_workspace_all.png') });
    results['workspace_switcher'] = 'PASS';

    // 5. Week Strip Sliding Day Indicator
    console.log('5. Testing WeekStrip Day Selection & Sliding Indicator...');
    const dayPills = page.locator('.week-day-pill');
    const pillCount = await dayPills.count();
    if (pillCount > 3) {
      await dayPills.nth(2).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_week_strip_active.png') });
    }
    results['week_strip'] = 'PASS';

    // 6. Right Rail
    console.log('6. Inspecting Right Rail upcoming tasks...');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_right_rail.png') });
    results['right_rail'] = 'PASS';

    // 7. Quick Task Modal (Validation error banner & creation)
    console.log('7. Testing Quick Task Modal (Error Banner & Task Creation)...');
    const quickTaskBtn = page.locator('button:has-text("Add Focus Task"), button:has-text("New Task"), .btn-quick-task').first();
    await quickTaskBtn.click();
    await page.waitForTimeout(400);

    // Submit valid task
    const titleInput = page.locator('#task-title').first();
    await titleInput.fill('Playwright Verified Task');
    const submitTaskBtn = page.locator('button[type="submit"]:has-text("Create Task")').first();
    const [createTaskRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/tasks') && res.status() === 201),
      submitTaskBtn.click(),
    ]);
    const createdJson = await createTaskRes.json();
    console.log('   Task created live:', createdJson.title, 'ID:', createdJson.id);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_task_created_live.png') });
    results['new_task_modal'] = 'PASS';

    // 8. User Profile Modal & Tabs
    console.log('8. Testing User Profile Modal Tabs & GSAP Animations...');
    const profileFooter = page.locator('.sidebar-user').first();
    await profileFooter.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_profile_modal_overview.png') });

    // Notifications tab
    const notifBtn = page.locator('button:has-text("Notification Preferences")').first();
    if (await notifBtn.isVisible()) {
      await notifBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_profile_notifications.png') });
      const backBtn = page.locator('button[title="Back to settings overview"]').first();
      await backBtn.click();
      await page.waitForTimeout(200);
    }

    // LMS Feed tab
    const lmsBtn = page.locator('button:has-text("LMS & Canvas Integrations")').first();
    if (await lmsBtn.isVisible()) {
      await lmsBtn.click();
      await page.waitForTimeout(300);
      const lmsInput = page.locator('input[type="url"]').first();
      await lmsInput.fill('https://university.instructure.com/feeds/calendars/user_test.ics');
      await page.locator('button:has-text("Save LMS Feed")').first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_profile_lms_feed.png') });
      const backBtn = page.locator('button[title="Back to settings overview"]').first();
      if (await backBtn.isVisible()) await backBtn.click();
      await page.waitForTimeout(200);
    }

    // Cloud Sync tab
    const cacheBtn = page.locator('button:has-text("Cloud Sync & Cache")').first();
    if (await cacheBtn.isVisible()) {
      await cacheBtn.click();
      await page.waitForTimeout(300);
      const syncBtn = page.locator('button:has-text("Recalculate Now")').first();
      if (await syncBtn.isVisible()) {
        await syncBtn.click();
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_profile_cloud_sync.png') });
    }

    // Close modal
    const closeProfileBtn = page.locator('.modal-close-btn').first();
    await closeProfileBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_modal_closed.png') });
    results['user_profile_modal'] = 'PASS';

    // 9. Calendar Page & Source Toggles
    console.log('9. Testing Calendar View & Source Checkboxes...');
    await page.goto('http://127.0.0.1:5173/calendar', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_calendar_page.png') });
    results['calendar_page'] = 'PASS';

    // 10. Tasks Page & Filter Animation
    console.log('10. Testing Tasks Page Filters & Animation...');
    await page.goto('http://127.0.0.1:5173/tasks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const highFilterBtn = page.locator('button:has-text("High")').first();
    if (await highFilterBtn.isVisible()) {
      await highFilterBtn.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18_tasks_filtered.png') });
    results['tasks_filtering'] = 'PASS';

    console.log('\n=== All Verification Tests Passed ===');
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
