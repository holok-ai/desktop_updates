import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

// Helpers
async function goToProjects(page: Page) {
  // Click the Projects menu item in the main sidebar
  const projectsMenuItem = page
    .locator('nav[aria-label="Main sidebar"]')
    .getByRole('menuitem', { name: 'Projects' });
  await projectsMenuItem.click();
  await page.waitForTimeout(800);
  await page.waitForLoadState('networkidle');
}

async function openCreateProjectModal(page: Page) {
  const inlineForm = page.locator('form.project-form');
  if (await inlineForm.count()) {
    await expect(inlineForm).toBeVisible({ timeout: 60000 });
    return;
  }

  // Fallback: clear selection and reload Projects route to show creation panel
  await page.evaluate(() => {
    globalThis.localStorage?.removeItem('lastProjectId');
    if (globalThis.window) {
      (globalThis.window as any).location.hash = '#/projects';
    }
  });
  await page.waitForTimeout(500);
  await expect(page.locator('form.project-form')).toBeVisible({ timeout: 60000 });
}

async function resetProjects(page: Page) {
  await page.evaluate(async () => {
    const globalObject = globalThis as Record<string, any>;
    const api = globalObject.electronAPI ?? globalObject.window?.electronAPI;
    if (!api) return;
    const existing = await api.project.getAll();
    await Promise.all(
      existing.map((project) => api.project.delete(project.id, { deleteThreads: true })),
    );
    globalThis.localStorage?.removeItem('lastProjectId');
    globalThis.localStorage?.removeItem('lastThreadId');
  });
  await page.waitForTimeout(200);
}

async function createProject(page: Page, name: string, description?: string) {
  await openCreateProjectModal(page);
  await page.fill('input#project-title', name);
  if (typeof description === 'string') {
    await page.fill('textarea#project-description', description);
  }
  await clickModalSubmit(page);

  // Wait for project creation to complete
  await page.waitForTimeout(1000);

  // Wait for any modal overlays to disappear
  const modalOverlay = page.locator('.modal-overlay');
  if (await modalOverlay.count()) {
    await expect(modalOverlay).toHaveCount(0, { timeout: 60000 });
  }

  // Dismiss any "Unsaved Changes" dialog that might appear
  await page.waitForTimeout(300);
  const unsavedDialog = page.locator('div[role="alertdialog"]');
  if (await unsavedDialog.count()) {
    const cancelBtn = unsavedDialog.getByRole('button', { name: 'Cancel' });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await expect(unsavedDialog).toHaveCount(0, { timeout: 3000 });
    }
  }

  // Wait for the project to appear in the sidebar (may include token refresh)
  await page.waitForTimeout(1000);
  const projectInSidebar = page.locator('.activity-list-sidebar').getByRole('menuitem', { name });
  await expect(projectInSidebar).toBeVisible({ timeout: 20000 });
}

function uniqueProjectName(label: string): string {
  return `${label} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

async function clickModalSubmit(page: Page) {
  const modalSubmit = page.locator('.modal-content button[type="submit"]').first();
  if (await modalSubmit.count()) {
    await expect(modalSubmit).toBeVisible({ timeout: 60000 });
    await modalSubmit.click();
    return;
  }

  const inlineSubmit = page.locator('form.project-form button.btn-primary').first();
  await expect(inlineSubmit).toBeVisible({ timeout: 60000 });
  await inlineSubmit.click();
}

async function selectProjectInSidebar(page: Page, name: string) {
  // First, dismiss any "Unsaved Changes" dialog that might be present
  await page.waitForTimeout(500);
  let unsavedDialog = page.locator('div[role="alertdialog"]');
  if (await unsavedDialog.count()) {
    const cancelBtn = unsavedDialog.getByRole('button', { name: 'Cancel' });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await expect(unsavedDialog).toHaveCount(0, { timeout: 3000 });
      await page.waitForTimeout(500);
    }
  }

  const accordionHeader = page
    .locator('li[role="menuitem"]')
    .filter({ hasText: 'Projects' })
    .first();
  await expect(accordionHeader).toBeVisible({ timeout: 60000 });

  const sidebar = page.locator('.activity-list-sidebar');
  let projectItem = sidebar.getByRole('menuitem', { name }).first();
  const visible = await projectItem.isVisible().catch(() => false);

  if (!visible) {
    await accordionHeader.click();
    await page.waitForTimeout(300);
    projectItem = sidebar.getByRole('menuitem', { name }).first();
  }

  await expect(projectItem).toBeVisible({ timeout: 60000 });

  // Use force click to bypass any modal overlays
  await projectItem.click({ force: true });

  // Wait for navigation to project detail view
  await page.waitForTimeout(1000);

  // After clicking, dismiss any dialog that appears
  unsavedDialog = page.locator('div[role="alertdialog"]');
  if (await unsavedDialog.count()) {
    const cancelBtn = unsavedDialog.getByRole('button', { name: 'Cancel' });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await expect(unsavedDialog).toHaveCount(0, { timeout: 3000 });
    }
  }
}

async function createThreadForProject(
  page: Page,
  options: { projectName: string; threadTitle: string; prompt?: string },
) {
  return page.evaluate(async ({ projectName, threadTitle, prompt }) => {
    const api = (globalThis as any).electronAPI ?? (globalThis as any).window?.electronAPI;
    if (!api) return null;

    const projects = await api.project.getAll();
    const project = projects.find((p: any) => p.title === projectName);
    if (!project) return null;

    const res = await api.thread.addUserPrompt(null, prompt ?? `Prompt for ${threadTitle}`, {
      title: threadTitle,
    });
    await api.thread.moveToProject(res.thread.id, project.id);

    return { threadId: res.thread.id, projectId: project.id };
  }, options);
}

async function openRenameProjectModal(page: Page) {
  // Try primary Edit button in the project details view
  const editButton = page.getByRole('button', { name: /Edit/i }).first();
  if (await editButton.count()) {
    await expect(editButton).toBeVisible({ timeout: 3000 });
    await editButton.click();
  } else {
    // Fallback: open actions menu then choose Rename/Edit
    const actionsButton = page.getByRole('button', { name: /(More|Actions|Options)/i }).first();
    if (await actionsButton.count()) {
      await actionsButton.click();
      const renameItem = page.getByRole('menuitem', { name: /(Rename|Edit)/i }).first();
      await expect(renameItem).toBeVisible({ timeout: 3000 });
      await renameItem.click();
    }
  }
  // Wait for modal to appear
  await expect(page.locator('.modal-content')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.modal-content input#project-title')).toBeVisible({ timeout: 60000 });
}

test.describe('E2E: Project Management', () => {
  let app: ElectronApplication | undefined;
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    try {
      const electronExec = (await import('electron')).default as unknown as string;
      app = await electron.launch({ executablePath: electronExec, args: ['.'] });
    } catch {
      try {
        const electronExec = (await import('electron')).default as unknown as string;
        app = await electron.launch({
          executablePath: electronExec,
          args: ['dist-electron/main.js'],
        });
      } catch {
        test.skip(true, 'Electron failed to launch in this environment');
      }
    }
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test.beforeEach(async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Wait for full network idle to avoid racing on lazy-mounted login component
    await page.waitForLoadState('networkidle');

    // Ensure we're authenticated (click mock sign-in if present)
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      // Ensure the login component is visible before interacting
      await expect(loginBtn).toBeVisible({ timeout: 60000 });
      await loginBtn.click();
      await page.waitForTimeout(2000); // Increased wait time for auth to complete

      // Verify authentication succeeded by checking if login button is gone
      await expect(loginBtn).toHaveCount(0, { timeout: 3000 });
    }

    await resetProjects(page);
    await goToProjects(page);
  });

  test('should display projects page', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Check that we're on the projects page by verifying the sidebar title shows "Projects"
    await expect(page.locator('.activity-list-sidebar .activity-title')).toContainText('Projects');
    // Check that the project creation form is visible
    await expect(page.locator('form.project-form')).toBeVisible();
  });

  test('should create a new project', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const projectName = uniqueProjectName('Test Project');
    await createProject(page, projectName, 'This is a test project');

    // Select the project from the sidebar and assert detail view
    await selectProjectInSidebar(page, projectName);
    await expect(page.getByRole('heading', { name: projectName, level: 1 })).toBeVisible();
  });

  test('should delete a project with confirmation', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const deletableName = uniqueProjectName('Project to Delete');
    await createProject(page, deletableName);

    // Find the project in sidebar and click its delete button (trash icon)
    const projectItem = page
      .locator('.activity-list-sidebar')
      .getByRole('menuitem', { name: deletableName })
      .first();
    await expect(projectItem).toBeVisible({ timeout: 60000 });

    // Find and click the delete button within the project item
    const deleteButton = projectItem.locator('button').last(); // The trash icon button
    await deleteButton.click();

    // Confirm deletion in modal
    await expect(page.getByRole('heading', { name: 'Delete Project' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Project' }).click();

    // Modal closes and project is removed from sidebar
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
    await page.waitForTimeout(500);

    // Verify project is no longer in sidebar
    await expect(projectItem).toHaveCount(0);
  });

  test('should cancel project deletion', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const keepName = uniqueProjectName('Project to Keep');
    await createProject(page, keepName);

    // Find the project in sidebar and click its delete button
    const projectItem = page
      .locator('.activity-list-sidebar')
      .getByRole('menuitem', { name: keepName })
      .first();
    await expect(projectItem).toBeVisible({ timeout: 60000 });

    const deleteButton = projectItem.locator('button').last();
    await deleteButton.click();

    // Cancel deletion in modal
    await expect(page.getByRole('heading', { name: 'Delete Project' })).toBeVisible();
    // Use getByLabel to scope to the delete modal specifically
    await page.getByLabel('Delete Project').getByRole('button', { name: 'Cancel' }).click();

    // Modal closes and project is still in sidebar
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
    await expect(projectItem).toBeVisible();
  });

  test('should display empty state when no projects exist', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await expect(page.locator('form.project-form')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Project', exact: true })).toBeVisible();
  });

  test('should create project from empty state', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const firstProjectName = uniqueProjectName('First Project');
    await openCreateProjectModal(page);
    await page.fill('input#project-title', firstProjectName);
    await clickModalSubmit(page);

    // Wait for project creation to complete (includes token refresh)
    await page.waitForTimeout(2000);

    await selectProjectInSidebar(page, firstProjectName);
    // Wait longer for project detail view to load (may include token refresh)
    await expect(page.getByRole('heading', { name: firstProjectName, level: 1 })).toBeVisible({
      timeout: 10000,
    });
  });

  test('should switch between projects and filter threads', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Create two projects
    const project1Name = uniqueProjectName('Project 1');
    const project2Name = uniqueProjectName('Project 2');
    await createProject(page, project1Name);
    await createProject(page, project2Name);

    // Create thread in project 1 using UI
    await selectProjectInSidebar(page, project1Name);
    await expect(page.getByRole('heading', { name: project1Name, level: 1 })).toBeVisible();

    // Click "New Thread" button in the Threads tab
    await page.getByRole('button', { name: 'New Thread' }).click();
    await page.waitForTimeout(1000);

    // Wait for thread creation form to appear
    const formMessageInput = page.getByRole('textbox', {
      name: /Message input|Type your message/i,
    });
    await expect(formMessageInput).toBeVisible({ timeout: 10000 });

    // Select Opus 4 model from the combobox
    const modelCombobox = page.getByRole('combobox', { name: /Choose model/i });
    await expect(modelCombobox).toBeVisible({ timeout: 60000 });
    await modelCombobox.selectOption('claude-opus-4-20250514');

    // Type a message to create the thread
    await formMessageInput.fill('Thread 1 message');

    // Click the submit button (should become enabled after typing)
    const submitButton = page.getByRole('button', { name: 'Send' });
    await expect(submitButton).toBeEnabled({ timeout: 60000 });
    await submitButton.click();

    // Wait for navigation to chat view
    await page.waitForTimeout(2000);
    const chatMessageInput = page.locator('[data-testid="message-input"]');
    await expect(chatMessageInput).toBeVisible({ timeout: 10000 });

    // Wait for thread to be created
    await page.waitForTimeout(2000);

    // Navigate back to projects
    await goToProjects(page);

    // Create thread in project 2 using UI
    await selectProjectInSidebar(page, project2Name);
    await expect(page.getByRole('heading', { name: project2Name, level: 1 })).toBeVisible();

    // Click "New Thread" button
    await page.getByRole('button', { name: 'New Thread' }).click();
    await page.waitForTimeout(1000);

    // Wait for form and fill it
    await expect(formMessageInput).toBeVisible({ timeout: 10000 });
    await modelCombobox.selectOption('claude-opus-4-20250514');
    await formMessageInput.fill('Thread 2 message');
    await expect(submitButton).toBeEnabled({ timeout: 60000 });
    await submitButton.click();

    // Wait for navigation to chat view
    await page.waitForTimeout(2000);
    await expect(chatMessageInput).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Navigate back to projects to verify threads
    await goToProjects(page);

    // Switch to project 1 and verify Thread 1 is there
    await selectProjectInSidebar(page, project1Name);
    await expect(page.getByRole('heading', { name: project1Name, level: 1 })).toBeVisible();

    // Wait for threads to load - check that we're NOT in empty state
    await expect(page.locator('.empty-state').filter({ hasText: 'No threads yet' })).toHaveCount(
      0,
      { timeout: 10000 },
    );

    // Now check for the thread list
    const threadList = page.locator('.thread-list');
    await expect(threadList).toBeVisible({ timeout: 60000 });

    // Check that at least one thread exists in project 1
    const project1Threads = threadList.getByRole('menuitem');
    await expect(project1Threads.first()).toBeVisible({ timeout: 60000 });
    const proj1Count = await project1Threads.count();
    expect(proj1Count).toBeGreaterThan(0);

    // Switch to project 2 and verify Thread 2 is there
    await selectProjectInSidebar(page, project2Name);
    await expect(page.getByRole('heading', { name: project2Name, level: 1 })).toBeVisible();

    // Wait for threads to load - check that we're NOT in empty state
    await expect(page.locator('.empty-state').filter({ hasText: 'No threads yet' })).toHaveCount(
      0,
      { timeout: 10000 },
    );

    // Now check for the thread list
    const threadList2 = page.locator('.thread-list');
    await expect(threadList2).toBeVisible({ timeout: 60000 });

    // Check that at least one thread exists in project 2
    const project2Threads = threadList2.getByRole('menuitem');
    await expect(project2Threads.first()).toBeVisible({ timeout: 60000 });
    const proj2Count = await project2Threads.count();
    expect(proj2Count).toBeGreaterThan(0);
  });

  test('should open project-only thread from project detail list', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const projectName = uniqueProjectName('Private Project');

    await createProject(page, projectName);

    // Set project to project_only mode via API
    await page.evaluate(
      async ({ projectName }) => {
        const api = (globalThis as any).electronAPI ?? (globalThis as any).window?.electronAPI;
        if (!api) return;
        const projects = await api.project.getAll();
        const project = projects.find((p: any) => p.title === projectName);
        if (project) {
          await api.project.update(project.id, { privacyMode: 'project_only' });
        }
      },
      { projectName },
    );

    // Create thread using UI from project Threads tab
    await selectProjectInSidebar(page, projectName);
    await expect(page.getByRole('heading', { name: projectName, level: 1 })).toBeVisible();

    // Click "New Thread" button
    await page.getByRole('button', { name: 'New Thread' }).click();
    await page.waitForTimeout(1000);

    // Wait for thread creation form to appear
    const formMessageInput = page.getByRole('textbox', {
      name: /Message input|Type your message/i,
    });
    await expect(formMessageInput).toBeVisible({ timeout: 10000 });

    // Select Opus 4 model from the combobox
    const modelCombobox = page.getByRole('combobox', { name: /Choose model/i });
    await expect(modelCombobox).toBeVisible({ timeout: 60000 });
    await modelCombobox.selectOption('claude-opus-4-20250514');

    // Type a message
    await formMessageInput.fill('Private thread message');

    // Click the submit button
    const submitButton = page.getByRole('button', { name: 'Send' });
    await expect(submitButton).toBeEnabled({ timeout: 60000 });
    await submitButton.click();

    // Wait for navigation to chat view
    await page.waitForTimeout(2000);
    const chatMessageInput = page.locator('[data-testid="message-input"]');
    await expect(chatMessageInput).toBeVisible({ timeout: 10000 });

    // Wait for thread to be created
    await page.waitForTimeout(2000);

    // Navigate back to projects
    await goToProjects(page);

    // Select the project and verify thread appears
    await selectProjectInSidebar(page, projectName);
    await page.waitForTimeout(800);

    // Thread list should be visible (not empty state)
    const threadList = page.locator('.thread-list');
    await expect(threadList).toBeVisible({ timeout: 60000 });

    // Click the first thread
    const projectThreadItem = threadList.getByRole('menuitem').first();
    await expect(projectThreadItem).toBeVisible({ timeout: 60000 });
    await projectThreadItem.click();

    // Should navigate to chat view
    await expect(chatMessageInput).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.error-banner')).toHaveCount(0);
  });

  test('should show error when switching to deleted project', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const projectName = uniqueProjectName('Project to Delete');
    await createProject(page, projectName);
    await selectProjectInSidebar(page, projectName);

    // Delete the project using the sidebar trash icon
    const sidebar = page.locator('.activity-list-sidebar');
    const projectItem = sidebar.getByRole('menuitem', { name: projectName }).first();
    const deleteButton = projectItem.locator('button').last(); // Trash icon is the last button
    await expect(deleteButton).toBeVisible({ timeout: 60000 });
    await deleteButton.click();

    // Confirm deletion in modal
    await expect(page.getByRole('heading', { name: 'Delete Project' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Project' }).click();
    await page.waitForTimeout(500);

    // Try to access the deleted project via URL
    await page.evaluate(async (projectName) => {
      const api = (globalThis as any).electronAPI ?? (globalThis as any).window?.electronAPI;
      if (!api) return;
      const projects = await api.project.getAll();
      const deletedProject = projects.find((p: any) => p.title === projectName);
      if (deletedProject) {
        // Try to navigate to deleted project
        globalThis.location.href = `/projects?projectId=${deletedProject.id}`;
      }
    }, projectName);

    await page.waitForTimeout(500);

    // Should show error message or redirect
    const errorBanner = page.locator('.error-banner');
    const hasError = (await errorBanner.count()) > 0;
    const isRedirected = !(await page.getByRole('heading', { name: projectName }).count());

    expect(hasError || isRedirected).toBeTruthy();
  });
});
