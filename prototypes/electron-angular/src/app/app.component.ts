import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root Application Component
 * 
 * This is the root component of the application.
 * It simply provides the router outlet for child routes.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styles: []
})
export class AppComponent {
  title = 'Holokai Desktop';
}
