<script lang="ts">
  /**
   * Home Page - Dashboard
   * Displays overview of LLM models, recent projects, invitations, support, and metrics
   */
  import { onMount } from 'svelte';
  import { projects } from '$lib/stores/project.store';
  import { modelService } from '$lib/services/model.service';
  import type { MockInvitation } from '$lib/types/dashboard.type';
  import type { Project } from '$lib/types/project.type';
  import type { ApplicationSummary } from '../../src-electron/preload';

  // Dashboard Components
  import ModelListCard from '$lib/components/dashboard/ModelListCard.svelte';
  import RecentProjectsCard from '$lib/components/dashboard/RecentProjectsCard.svelte';
  import InvitationsCard from '$lib/components/dashboard/InvitationsCard.svelte';
  import SupportCard from '$lib/components/dashboard/SupportCard.svelte';
  import ResourcesCard from '$lib/components/dashboard/ResourcesCard.svelte';
  import MetricsChartsSection from '$lib/components/dashboard/MetricsChartsSection.svelte';

  // State
  let isLoading = $state(true);
  let recentProjects = $state<Project[]>([]);
  let availableApplications = $state<ApplicationSummary[]>([]);
  let auditData = $state<any[]>([]);
  let mockInvitations = $state<MockInvitation[]>([]);

  /**
   * Generate mock invitation data
   */
  function generateMockInvitations(): MockInvitation[] {
    return [
      {
        id: 'inv-1',
        projectId: 'mock-1',
        projectName: 'Q1 Marketing Campaign',
        invitedBy: { name: 'Sarah Chen', email: 'sarah.chen@holokai.com' },
        invitedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'pending',
        message: 'Join us for campaign planning and execution',
      },
      {
        id: 'inv-2',
        projectId: 'mock-2',
        projectName: 'Product Analytics Dashboard',
        invitedBy: { name: 'Michael Torres', email: 'michael.torres@holokai.com' },
        invitedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'pending',
      },
      {
        id: 'inv-3',
        projectId: 'mock-3',
        projectName: 'Customer Research Initiative',
        invitedBy: { name: 'Emily Rodriguez', email: 'emily.r@holokai.com' },
        invitedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'pending',
        message: 'Help us analyze customer feedback and insights',
      },
    ];
  }

  /**
   * Generate sample audit data for charts when no real data exists
   */
  function generateSampleAuditData(): any[] {
    const now = Date.now();
    const sampleData: any[] = [];
    const models = [
      { provider: 'CLAUDE', model: 'claude-sonnet-3.5' },
      { provider: 'CLAUDE', model: 'claude-opus-3' },
      { provider: 'OPENAI', model: 'gpt-4-turbo' },
      { provider: 'OPENAI', model: 'gpt-3.5-turbo' },
      { provider: 'OLLAMA', model: 'llama2' },
    ];

    // Generate data for last 14 days
    for (let day = 0; day < 14; day++) {
      const dayTimestamp = now - day * 24 * 60 * 60 * 1000;

      // Generate 5-15 prompts per day
      const promptsPerDay = Math.floor(Math.random() * 10) + 5;

      for (let i = 0; i < promptsPerDay; i++) {
        // Random hour between 8 AM and 6 PM
        const hour = Math.floor(Math.random() * 11) + 8;
        const minute = Math.floor(Math.random() * 60);
        const timestamp = dayTimestamp + hour * 60 * 60 * 1000 + minute * 60 * 1000;

        // Random model
        const modelData = models[Math.floor(Math.random() * models.length)];

        // Random token count (500-5000)
        const totalTokenCount = Math.floor(Math.random() * 4500) + 500;

        sampleData.push({
          requestTimestamp: timestamp,
          provider: modelData.provider,
          model: modelData.model,
          totalTokenCount,
        });
      }
    }

    return sampleData.sort((a, b) => a.requestTimestamp - b.requestTimestamp);
  }

  /**
   * Load audit logs for metrics charts
   */
  async function loadAuditData(): Promise<void> {
    try {
      const logs = await window.electronAPI.chat.getAuditLogs();
      auditData = logs || [];

      // If no real data, use sample data for demonstration
      if (auditData.length === 0) {
        console.log('[Dashboard] No audit data found, using sample data for charts');
        auditData = generateSampleAuditData();
      }
    } catch (error) {
      console.error('[Dashboard] Error loading audit data:', error);
      // Use sample data on error
      auditData = generateSampleAuditData();
    }
  }

  /**
   * Load available applications
   */
  async function loadApplications(): Promise<void> {
    try {
      // Reset to empty array before loading to prevent duplicates
      availableApplications = [];
      availableApplications = await modelService.getAvailableApplications();
    } catch (error) {
      console.error('[Dashboard] Error loading applications:', error);
      availableApplications = [];
    }
  }

  /**
   * Initialize dashboard data
   */
  onMount(async () => {
    // Reset state on mount to prevent stale data
    availableApplications = [];
    recentProjects = [];
    auditData = [];
    mockInvitations = [];
    isLoading = true;

    try {
      // Load all data in parallel
      await Promise.all([loadApplications(), loadAuditData()]);

      // Get recent projects from store (sorted by updatedAt desc)
      recentProjects = $projects
        .sort((a, b) => {
          const aTime =
            typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt).getTime();
          const bTime =
            typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt).getTime();
          return bTime - aTime;
        })
        .slice(0, 5);

      // Generate mock invitations
      mockInvitations = generateMockInvitations();
    } catch (error) {
      console.error('[Dashboard] Error loading dashboard data:', error);
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="dashboard-page">
  <div class="dashboard-scroll-area">
    <div class="dashboard-content">
      <!-- Header -->
      <div class="dashboard-header">
        <h1>Welcome to Holokai Desktop</h1>
        <p class="subtitle">Your AI workflow command center</p>
      </div>

      <!-- Loading State -->
      {#if isLoading}
        <div class="loading-state">
          <i class="pi pi-spin pi-spinner loading-icon"></i>
          <p>Loading dashboard...</p>
        </div>
      {:else}
        <!-- Dashboard Grid -->
        <div class="dashboard-grid">
          <ModelListCard {availableApplications} />
          <RecentProjectsCard {recentProjects} />
          <InvitationsCard {mockInvitations} />
          <SupportCard />
          <ResourcesCard />
        </div>

        <!-- Full-width Metrics Section -->
        <div class="metrics-section">
          <MetricsChartsSection {auditData} />
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dashboard-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .dashboard-scroll-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .dashboard-content {
    max-width: 1400px;
    margin-left: 30px;
    margin-right: 1.5rem;
    padding: 1.5rem 0;
  }

  .dashboard-header {
    margin-bottom: 2rem;
  }

  .dashboard-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    font-size: 1.125rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .loading-icon {
    font-size: 3rem;
    color: var(--primary-color);
    margin-bottom: 1rem;
  }

  .loading-state p {
    font-size: 1rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .metrics-section {
    margin-bottom: 1.5rem;
  }

  /* Responsive breakpoints */
  @media (max-width: 768px) {
    .dashboard-content {
      margin-left: 1rem;
      margin-right: 1rem;
    }

    .dashboard-header h1 {
      font-size: 1.5rem;
    }

    .subtitle {
      font-size: 1rem;
    }

    .dashboard-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (min-width: 1200px) {
    .dashboard-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
