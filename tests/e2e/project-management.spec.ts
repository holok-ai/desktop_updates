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
  // Use the Projects page CTA
  const createBtn = page.getByRole('button', { name: 'Create New Project' });
  if (await createBtn.count()) {
    if (await createBtn.isVisible()) {
      await createBtn.click();
      return;
    }
  }
  // Fallback: use quick action in secondary sidebar when on Home
  const newProjectQuick = page.getByRole('menuitem', { name: 'New Project' });
  if (await newProjectQuick.count()) {
    await newProjectQuick.click();
  }
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
  await expect(page.locator('.modal-overlay')).toHaveCount(0);
}

function uniqueProjectName(label: string): string {
  return `${label} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

async function clickModalSubmit(page: Page) {
  // Target the submit button by type to avoid label changes (Creating.../Saving...)
  const submit = page.locator('.modal-content button[type="submit"]').first();
  await expect(submit).toBeVisible({ timeout: 5000 });
  await submit.click();
}

async function selectProjectInSidebar(page: Page, name: string) {
  // Click on the Projects accordion header to expand it if needed
  const accordionHeader = page.locator('li[role="menuitem"]').filter({ hasText: 'Projects' }).first();
  await expect(accordionHeader).toBeVisible({ timeout: 5000 });
  
  // Check if the Projects accordion content is visible by looking for "Create Project" text
  // which is unique to the Projects accordion
  const createProjectItem = page.getByRole('menuitem', { name: 'Create Project' });
  const createProjectVisible = await createProjectItem.isVisible().catch(() => false);
  if (!createProjectVisible) {
    await accordionHeader.click();
    await page.waitForTimeout(300);
    // Wait for the accordion content to appear
    await expect(createProjectItem).toBeVisible({ timeout: 3000 });
  }
  
  // Find and click the project item
  // Scope to the Projects accordion by finding the accordion-content that contains "Create Project"
  const projectsAccordionContent = page.locator('.accordion-content').filter({ hasText: 'Create Project' }).first();
  const projectItem = projectsAccordionContent.getByRole('menuitem', { name }).first();
  await expect(projectItem).toBeVisible({ timeout: 5000 });
  await projectItem.click();
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
    await expect(page.getByRole('button', { name: 'Create New Project' })).toBeVisible();
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

    const submitButton = page.locator('.modal-content button[type="submit"]').first();

    await expect(submitButton).toBeDisabled();
    // Ensure some element within modal has focus before sending Escape
    await page.focus('input#project-name');
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal-overlay')).toHaveCount(0);
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

    await expect(page.getByText('Select a project from the sidebar to view details')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create New Project' })).toBeVisible();
  });

  test('should create project from empty state', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const firstProjectName = uniqueProjectName('First Project');
    await page.getByRole('button', { name: 'Create New Project' }).click();
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

    // Switch to project 1
    await selectProjectInSidebar(page, project1Name);
    await expect(page.getByRole('heading', { name: project1Name, level: 1 })).toBeVisible();

    // Wait for threads to load (ActivityListSidebar will reload threads when project is selected)
    await page.waitForTimeout(800);

    // Verify threads are filtered in the sidebar (ActivityListSidebar)
    // Threads should appear in the secondary sidebar when project is selected
    const sidebar = page.locator('.activity-list-sidebar');
    
    // Wait for Thread 1 to appear (it should be visible for project 1)
    // Threads are displayed as menuitems in accordion sections
    // Use first() to handle cases where there might be multiple matches
    await expect(sidebar.getByRole('menuitem', { name: 'Thread 1' }).first()).toBeVisible({ timeout: 5000 });
    
    const thread1Visible = await sidebar.getByRole('menuitem', { name: 'Thread 1' }).count();
    const thread2Visible = await sidebar.getByRole('menuitem', { name: 'Thread 2' }).count();
    
    // Thread 1 should be visible, Thread 2 should not be visible
    expect(thread1Visible).toBeGreaterThan(0);
    expect(thread2Visible).toBe(0);

    // Switch to project 2
    await selectProjectInSidebar(page, project2Name);
    await expect(page.getByRole('heading', { name: project2Name, level: 1 })).toBeVisible();

    // Wait for threads to reload (ActivityListSidebar will reload threads when project changes)
    await page.waitForTimeout(800);

    // Wait for Thread 2 to appear (it should be visible for project 2)
    await expect(sidebar.getByRole('menuitem', { name: 'Thread 2' }).first()).toBeVisible({ timeout: 5000 });

    // Verify threads are filtered for project 2
    const thread1VisibleAfter = await sidebar.getByRole('menuitem', { name: 'Thread 1' }).count();
    const thread2VisibleAfter = await sidebar.getByRole('menuitem', { name: 'Thread 2' }).count();
    
    // Thread 2 should be visible, Thread 1 should not be visible
    expect(thread2VisibleAfter).toBeGreaterThan(0);
    expect(thread1VisibleAfter).toBe(0);
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
    const hasError = await errorBanner.count() > 0;
    const isRedirected = !(await page.getByRole('heading', { name: projectName }).count());

    expect(hasError || isRedirected).toBeTruthy();
  });
});
