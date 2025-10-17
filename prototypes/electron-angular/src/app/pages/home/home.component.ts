import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { ElectronService } from '../../core/services/electron.service';
import { AuthService } from '../../core/services/auth.service';
import { UserProfile } from '../../../../src-electron/preload';

/**
 * Home Component
 * 
 * This is the landing page that demonstrates basic Electron integration.
 * It shows system information retrieved via IPC.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, ButtonModule, AvatarModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  isElectron = false;
  systemInfo: {
    platform?: string;
    version?: string;
    appDataPath?: string;
  } = {};
  
  currentUser: UserProfile | null = null;
  authState$ = this.authService.authState$;

  constructor(
    private electronService: ElectronService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.isElectron = this.electronService.isElectron;

    if (this.isElectron) {
      // Check authentication
      const isAuthenticated = await this.authService.isAuthenticated();
      if (!isAuthenticated) {
        this.router.navigate(['/login']);
        return;
      }
      
      // Load user profile and system info
      this.currentUser = await this.authService.getUser();
      await this.loadSystemInfo();
    }
  }

  async loadSystemInfo(): Promise<void> {
    try {
      const api = this.electronService.api;
      
      // Get system information via IPC
      this.systemInfo.platform = await api.system.platform();
      this.systemInfo.version = await api.system.version();
      this.systemInfo.appDataPath = await api.system.getPath('appData');
    } catch (error) {
      console.error('Error loading system info:', error);
    }
  }
  
  async onLogout(): Promise<void> {
    try {
      await this.authService.logout();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
