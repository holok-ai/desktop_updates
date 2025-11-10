import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

// Helpers
async function goToProjects(page: Page) {
  // Navigate via main sidebar to Projects
  await page.getByRole('menuitem', { name: 'Projects' }).click();
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
  // Ensure Projects activity is active
  await page.getByRole('menuitem', { name: 'Projects' }).click();
  // Project appears as a menuitem in the Projects activity list
  const item = page.getByRole('menuitem', { name }).first();
  await expect(item).toBeVisible({ timeout: 5000 });
  await item.click();
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
});
