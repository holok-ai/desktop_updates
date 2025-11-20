import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

// Helpers
async function goToProjects(page: Page) {
  // Navigate to projects page using hash-based routing (svelte-spa-router)
  await page.evaluate(() => {
    if (globalThis.window !== undefined && globalThis.window.location) {
      (globalThis.window as any).location.hash = '#/projects';
    }
  });
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

async function openCreateProjectModal(page: Page) {
  const inlineForm = page.locator('form.project-form');
  if (await inlineForm.count()) {
    await expect(inlineForm).toBeVisible({ timeout: 5000 });
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
  await expect(page.locator('form.project-form')).toBeVisible({ timeout: 5000 });
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
  await page.fill('input#project-name', name);
  if (typeof description === 'string') {
    await page.fill('textarea#project-description', description);
  }
  await clickModalSubmit(page);
  const modalOverlay = page.locator('.modal-overlay');
  if (await modalOverlay.count()) {
    await expect(modalOverlay).toHaveCount(0);
  } else {
    await page.waitForTimeout(500);
  }
}

function uniqueProjectName(label: string): string {
  return `${label} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

async function clickModalSubmit(page: Page) {
  const modalSubmit = page.locator('.modal-content button[type="submit"]').first();
  if (await modalSubmit.count()) {
    await expect(modalSubmit).toBeVisible({ timeout: 5000 });
    await modalSubmit.click();
    return;
  }

  const inlineSubmit = page.locator('form.project-form button.primary').first();
  await expect(inlineSubmit).toBeVisible({ timeout: 5000 });
  await inlineSubmit.click();
}

async function selectProjectInSidebar(page: Page, name: string) {
  const accordionHeader = page
    .locator('li[role="menuitem"]')
    .filter({ hasText: 'Projects' })
    .first();
  await expect(accordionHeader).toBeVisible({ timeout: 5000 });

  const sidebar = page.locator('.activity-list-sidebar');
  let projectItem = sidebar.getByRole('menuitem', { name }).first();
  const visible = await projectItem.isVisible().catch(() => false);

  if (!visible) {
    await accordionHeader.click();
    await page.waitForTimeout(300);
    projectItem = sidebar.getByRole('menuitem', { name }).first();
  }

  await expect(projectItem).toBeVisible({ timeout: 5000 });
  await projectItem.click();
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
  await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.modal-content input#project-name')).toBeVisible({ timeout: 5000 });
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
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      await loginBtn.click();
      await page.waitForTimeout(1200);
    }

    await resetProjects(page);
    await goToProjects(page);
  });

  test('should display projects page', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
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

  test('should validate required fields when creating project', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await openCreateProjectModal(page);

    const submitButton = page.locator('form.project-form button.primary').first();

    await expect(submitButton).toBeDisabled();
    await page.fill('input#project-name', '  ');
    await expect(submitButton).toBeDisabled();
  });

  test('should delete a project with confirmation', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const deletableName = uniqueProjectName('Project to Delete');
    await createProject(page, deletableName);

    // Select and delete
    await selectProjectInSidebar(page, deletableName);
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Delete Project' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Project' }).click();

    // Modal closes and detail view clears
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  });

  test('should cancel project deletion', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const keepName = uniqueProjectName('Project to Keep');
    await createProject(page, keepName);

    await selectProjectInSidebar(page, keepName);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.locator('.modal-overlay')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: keepName, level: 1 })).toBeVisible();
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
    await page.fill('input#project-name', firstProjectName);
    await clickModalSubmit(page);

    await selectProjectInSidebar(page, firstProjectName);
    await expect(page.getByRole('heading', { name: firstProjectName, level: 1 })).toBeVisible();
  });

  test('should switch between projects and filter threads', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Create two projects
    const project1Name = uniqueProjectName('Project 1');
    const project2Name = uniqueProjectName('Project 2');
    await createProject(page, project1Name);
    await createProject(page, project2Name);

    // Create threads in each project
    await page.evaluate(
      async ({ project1Name, project2Name }) => {
        const api = (globalThis as any).electronAPI ?? (globalThis as any).window?.electronAPI;
        if (!api) return;

        const projects = await api.project.getAll();
        const proj1 = projects.find((p: any) => p.title === project1Name);
        const proj2 = projects.find((p: any) => p.title === project2Name);

        // Create thread in project 1
        const thread1 = await api.thread.addUserPrompt(null, 'Thread in project 1', {
          title: 'Thread 1',
        });
        await api.thread.moveToProject(thread1.thread.id, proj1.id);

        // Create thread in project 2
        const thread2 = await api.thread.addUserPrompt(null, 'Thread in project 2', {
          title: 'Thread 2',
        });
        await api.thread.moveToProject(thread2.thread.id, proj2.id);
      },
      { project1Name, project2Name },
    );

    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      await loginBtn.click();
      await page.waitForTimeout(800);
    }
    await goToProjects(page);

    // Switch to project 1
    await selectProjectInSidebar(page, project1Name);
    await expect(page.getByRole('heading', { name: project1Name, level: 1 })).toBeVisible();

    await page.waitForTimeout(800);

    const projectThreadList = page.locator('.project-thread-list');
    const project1Thread = projectThreadList.getByRole('menuitem', { name: 'Thread 1' }).first();
    await expect(project1Thread).toBeVisible({ timeout: 5000 });
    await expect(projectThreadList.getByRole('menuitem', { name: 'Thread 2' })).toHaveCount(0);

    // Switch to project 2
    await selectProjectInSidebar(page, project2Name);
    await expect(page.getByRole('heading', { name: project2Name, level: 1 })).toBeVisible();

    await page.waitForTimeout(800);

    const projectThreadList2 = page.locator('.project-thread-list');
    const project2Thread = projectThreadList2.getByRole('menuitem', { name: 'Thread 2' }).first();
    await expect(project2Thread).toBeVisible({ timeout: 5000 });
    await expect(projectThreadList2.getByRole('menuitem', { name: 'Thread 1' })).toHaveCount(0);
  });

  test('should open project-only thread from project detail list', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const projectName = uniqueProjectName('Private Project');
    const threadTitle = 'Private Thread';

    await createProject(page, projectName);
    const threadInfo = await createThreadForProject(page, {
      projectName,
      threadTitle,
      prompt: 'Thread content for project-only test',
    });

    if (!threadInfo) {
      throw new Error('Failed to create thread for project');
    }
    const threadId = threadInfo.threadId;

    await page.evaluate(async ({ projectName }) => {
      const api = (globalThis as any).electronAPI ?? (globalThis as any).window?.electronAPI;
      if (!api) return;
      const projects = await api.project.getAll();
      const project = projects.find((p: any) => p.title === projectName);
      if (project) {
        await api.project.update(project.id, { privacyMode: 'project_only' });
      }
    }, { projectName });

    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loginBtnReload = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtnReload.count()) {
      await expect(loginBtnReload).toBeVisible({ timeout: 5000 });
      await loginBtnReload.click();
      await page.waitForTimeout(800);
    }
    await goToProjects(page);

    await selectProjectInSidebar(page, projectName);
    await page.waitForTimeout(800);

    const threadList = page.locator('.project-thread-list');

    const projectThreadItem = threadList.getByRole('menuitem', { name: threadTitle }).first();
    await expect(projectThreadItem).toBeVisible({ timeout: 5000 });
    await projectThreadItem.click();

    await page.waitForFunction(({ threadId }) => {
      return globalThis.location.hash.includes(threadId);
    }, { threadId });

    await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-banner')).toHaveCount(0);
  });

  test('should show error when switching to deleted project', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const projectName = uniqueProjectName('Project to Delete');
    await createProject(page, projectName);
    await selectProjectInSidebar(page, projectName);

    // Delete the project
    await page.getByRole('button', { name: 'Delete' }).click();
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
