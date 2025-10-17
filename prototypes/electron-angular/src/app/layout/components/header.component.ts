import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

/**
 * Header Component
 * 
 * This component displays the top header bar, primarily used on mobile devices.
 * It contains a menu button to toggle the mobile navigation.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  @Output() menuToggle = new EventEmitter<boolean>();

  mobileMenuOpen = false;

  toggleMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.menuToggle.emit(this.mobileMenuOpen);
  }
}
