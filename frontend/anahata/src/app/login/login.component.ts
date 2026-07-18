import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router      // ← inject here
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }

  onSubmit() {
    if (this.loginForm.valid) {
      const name = this.loginForm.value.email.split('@')[0];
      sessionStorage.setItem('userName', name);
      this.router.navigate(['/welcome'], { state: { userName: name } });
    }
  }

  continueAsGuest() {
    sessionStorage.setItem('userName', 'Guest');
    this.router.navigate(['/welcome'], { state: { userName: 'Guest' } });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
