import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header.component';
import { NavbarComponent } from './components/navbar.component';

/**
 * App Layout Component
 * 
 * This component provides the main layout structure with:
 * - A collapsible sidebar (navbar)
 * - A top header bar
 * - A main content area for routed components
 * 
 * The layout uses flexbox to create a responsive structure.
 */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, NavbarComponent],
  templateUrl: './app-layout.component.html',
  styleUrls: ['./app-layout.component.css']
})
export class AppLayout {
  mobileNavVisible = false;

  onMenuToggle(visible: boolean): void {
    this.mobileNavVisible = visible;
  }

  closeMobileNav(): void {
    this.mobileNavVisible = false;
  }
}
