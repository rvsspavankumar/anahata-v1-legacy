// import { Component } from '@angular/core';
// import { Router } from '@angular/router';
// import { FormBuilder, FormGroup, Validators } from '@angular/forms';

// @Component({
//   selector: 'app-questionnaire',
//   templateUrl: './mood-questionnaire.component.html',
//   styleUrls: ['./mood-questionnaire.component.scss'],
//   standalone: true,
// })
// export class QuestionnaireComponent {
//   userName: string = 'Pavan'; // Replace later with dynamic value from state
//   constructor(private router: Router) {
//     const nav = window.history.state;
//     if(nav?.userName) this.userName = nav.userName;
//   }

//   goToQuestions() {
//     this.router.navigate(['/basic-questions']);
//   }

//   goToMoodSelect() {
//     this.router.navigate(['/mood-selector']);
//   }
// }
// export class MoodQuestionnaireQuestionsComponent {
//   questionnaireForm: FormGroup;

//   constructor(private fb: FormBuilder, private router: Router) {
//     this.questionnaireForm = this.fb.group({
//       energy: [null, Validators.required],
//       motivation: [null, Validators.required],
//       sleep: [null, Validators.required],
//       stability: [null, Validators.required],
//       connection: [null, Validators.required]
//     });
//   }

//   onSubmit() {
//     if (this.questionnaireForm.valid) {
//       const values = this.questionnaireForm.value;
//       const totalScore = Object.values(values).reduce((a: number, b: number) => a + Number(b), 0);
//       console.log('Mood Score:', totalScore);
//       this.router.navigate(['/mood-summary'], { state: { moodScore: totalScore } });
//     }
//   }
// }

import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

/* =========================
   SCREEN 1: Entry / Hub
   ========================= */
@Component({
  selector: 'app-questionnaire',
  templateUrl: './mood-questionnaire.component.html',
  styleUrls: ['./mood-questionnaire.component.scss'],
  standalone: true,
  imports: [CommonModule] // add more if your HTML needs them
})
export class QuestionnaireComponent {
  userName: string = 'Guest';

  constructor(private router: Router) {
    const nav = window.history.state;

    // Pull from navigation state first
    if (nav?.userName) {
      this.userName = String(nav.userName);
      sessionStorage.setItem('userName', this.userName); // persist for refreshes
    } else {
      // Fallback on refresh/direct load
      this.userName = sessionStorage.getItem('userName') ?? 'Guest';
    }
  }

  goToQuestions() {
    this.router.navigate(['/basic-questions'], { state: { userName: this.userName } });
  }

  goToMoodSelect() {
    this.router.navigate(['/mood-selector'], { state: { userName: this.userName } });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logoff(): void {
    sessionStorage.removeItem('userName');
    this.router.navigate(['/']);
  }
}

// /* =========================
//    SCREEN 2: Questions
//    ========================= */
// @Component({
//   selector: 'app-mood-questionnaire-questions',
//   templateUrl: './mood-questionnaire-questions.component.html',
//   styleUrls: ['./mood-questionnaire-questions.component.scss'],
//   standalone: true,
//   imports: [CommonModule, ReactiveFormsModule]
// })
export class MoodQuestionnaireQuestionsComponent {
  questionnaireForm: FormGroup;
  userName: string = 'P';

  constructor(private fb: FormBuilder, private router: Router) {
    // Read userName again (state first, then storage)
    const nav = window.history.state;
    if (nav?.userName) {
      this.userName = nav.userName;
      sessionStorage.setItem('userName', this.userName);
    } else {
      const fromStore = sessionStorage.getItem('userName');
      if (fromStore) this.userName = fromStore;
    }

    this.questionnaireForm = this.fb.group({
      energy: [null, Validators.required],
      motivation: [null, Validators.required],
      sleep: [null, Validators.required],
      stability: [null, Validators.required],
      connection: [null, Validators.required]
    });
  }

  onSubmit() {
    if (this.questionnaireForm.valid) {
      const values = this.questionnaireForm.value;
      const totalScore = Object.values(values as { [key: string]: number })
  .reduce((a, b) => a + b, 0);

      // Forward BOTH mood score and userName
      this.router.navigate(
        ['/mood-summary'],
        { state: { moodScore: totalScore, userName: this.userName } }
      );
    }
  }
}

// mood-summary.component.ts
export class MoodSummaryComponent {
  userName = '';
  moodScore = 0;

  constructor() {
    const nav = window.history.state;

    if (nav?.userName) {
      this.userName = String(nav.userName);
      sessionStorage.setItem('userName', this.userName);
    } else {
      this.userName = sessionStorage.getItem('userName') ?? 'Guest';
    }

    this.moodScore = nav?.moodScore ?? 0;
  }
}
