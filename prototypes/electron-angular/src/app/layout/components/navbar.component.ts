import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { AuthService } from '../../core/services/auth.service';
import { UserProfile } from '../../../../src-electron/preload';

/**
 * Navbar Component (Sidebar)
 *
 * This component displays the sidebar navigation with links to different pages.
 * It demonstrates the layout pattern used in the moku/web application.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, RippleModule, TooltipModule, AvatarModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  @Output() closeMobile = new EventEmitter<void>();

  isCollapsed = false;
  currentUser: UserProfile | null = null;
  userMenuExpanded = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  navigationItems = [
    {
      label: 'Home',
      icon: 'pi pi-home',
      route: '/home'
    },
    {
      label: 'Threads',
      icon: 'pi pi-comments',
      route: '/threads'
    }
  ];

  async ngOnInit() {
    // Load current user
    this.currentUser = await this.authService.getUser();
    
    // Subscribe to auth state changes
    this.authService.authState$.subscribe(state => {
      this.currentUser = state.user;
    });
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    // Close user menu when collapsing sidebar
    if (this.isCollapsed) {
      this.userMenuExpanded = false;
    }
  }

  toggleUserMenu(): void {
    this.userMenuExpanded = !this.userMenuExpanded;
  }

  onMobileClose(): void {
    this.closeMobile.emit();
  }

  /**
   * Log navigation item click
   */
  onNavigationClick(item: { label: string; route: string }): void {
    if (window.electronAPI?.log) {
      window.electronAPI.log.info(`Sidebar navigation clicked: ${item.label} (${item.route})`);
    }
  }

  /**
   * Handle logout
   */
  async onLogout(): Promise<void> {
    try {
      await this.authService.logout();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Toggle dark mode
   */
  async toggleDarkMode(): Promise<void> {
    try {
      if (window.electronAPI?.settings) {
        const currentTheme = await window.electronAPI.settings.get('theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        await window.electronAPI.settings.set('theme', newTheme);
        
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', newTheme);
        
        if (window.electronAPI?.log) {
          window.electronAPI.log.info(`Theme changed to: ${newTheme}`);
        }
      }
    } catch (error) {
      console.error('Error toggling dark mode:', error);
    }
  }
}
