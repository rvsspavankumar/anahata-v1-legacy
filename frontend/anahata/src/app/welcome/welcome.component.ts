/*import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent {
  userName: string = 'there';

  ngOnInit() {
    // Read passed state; fallback to "there"
    this.userName = history.state.userName ?? 'there';
  }
  goToQuestionnaire(){
    this.router.navigate(['/mood-questionnaire']);
  }
}
*/
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // ✅ Add this

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule], // ✅ Add RouterModule here
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent {
  userName: string = 'Guest';

  constructor(private router: Router) {
    const nav = window.history.state;
    if (nav?.userName) {
      this.userName = String(nav.userName);
      sessionStorage.setItem('userName', this.userName);
    } else {
      this.userName = sessionStorage.getItem('userName') ?? 'Guest';
    }
  }

  goToQuestionnaire() {
    this.router.navigate(['/mood-questionnaire'], { state: { userName: this.userName } });
  }

  goToDashboard(event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/dashboard']);
  }

  logoff(event: Event): void {
    event.stopPropagation();
    sessionStorage.removeItem('userName');
    this.router.navigate(['/']);
  }
}
