import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, Routes, withRouterConfig } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { APP_INITIALIZER } from '@angular/core';
import { AppComponent } from './app/app.component';
import { AppLayout } from './app/layout/app-layout.component';
import { LoginComponent } from './app/pages/login/login.component';
import { HomeComponent } from './app/pages/home/home.component';
import { ThreadsComponent } from './app/pages/threads/threads.component';
import { MenuNavigationService } from './app/core/services/menu-navigation.service';

/**
 * Application Routes
 * 
 * This defines the routing structure of the application.
 * All routes are wrapped with the AppLayout component which provides
 * the sidebar and header.
 */
const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: '',
    component: AppLayout,
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        component: HomeComponent
      },
      {
        path: 'threads',
        component: ThreadsComponent
      }
    ]
  }
];

/**
 * Bootstrap the Angular application
 */
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(
      routes,
      // Allow reloading same route (for menu refresh commands)
      withRouterConfig({ onSameUrlNavigation: 'reload' })
    ),
    provideAnimations(),
    // Initialize MenuNavigationService at app startup
    // This ensures menu handlers are registered before any user interaction
    {
      provide: APP_INITIALIZER,
      useFactory: (menuNavigationService: MenuNavigationService) => {
        return () => {
          console.log('App Initializer: MenuNavigationService initialized');
          // Service constructor has already run and registered handlers
        };
      },
      deps: [MenuNavigationService],
      multi: true
    }
  ]
}).catch(err => console.error(err));
