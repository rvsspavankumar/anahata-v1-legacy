import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-basic-questions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './basic-questions.component.html',
  styleUrl: './basic-questions.component.scss'
})
export class BasicQuestionsComponent {
  userName = 'Guest';
  submitted = false;
  moodScore = 0;
  readonly ratingOptions = [1, 2, 3, 4, 5];
  readonly questionsForm;

  constructor(private fb: FormBuilder, private router: Router) {
    this.questionsForm = this.fb.group({
      energy: [null as number | null, Validators.required],
      motivation: [null as number | null, Validators.required],
      sleepQuality: [null as number | null, Validators.required],
      stressLevel: [null as number | null, Validators.required],
      socialConnection: [null as number | null, Validators.required]
    });

    const nav = window.history.state;
    if (nav?.userName) {
      this.userName = String(nav.userName);
      sessionStorage.setItem('userName', this.userName);
    } else {
      this.userName = sessionStorage.getItem('userName') ?? 'Guest';
    }
  }

  onSubmit(): void {
    if (this.questionsForm.invalid) {
      this.questionsForm.markAllAsTouched();
      return;
    }

    const values = Object.values(this.questionsForm.getRawValue()) as number[];
    this.moodScore = values.reduce((sum, value) => sum + value, 0);
    this.submitted = true;

    setTimeout(() => {
      this.router.navigate(['/chat'], {
        state: { userName: this.userName, moodScore: this.moodScore }
      });
    }, 1200);
  }

  setRating(controlName: string, value: number): void {
    this.questionsForm.get(controlName)?.setValue(value);
    this.questionsForm.get(controlName)?.markAsTouched();
  }

  getRating(controlName: string): number | null {
    return this.questionsForm.get(controlName)?.value ?? null;
  }

  backToQuestionnaire(): void {
    this.router.navigate(['/mood-questionnaire'], { state: { userName: this.userName } });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logoff(): void {
    sessionStorage.removeItem('userName');
    this.router.navigate(['/']);
  }
}
