import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { WelcomeComponent } from './welcome/welcome.component';
import { QuestionnaireComponent } from './mood-questionnaire/mood-questionnaire.component';
import { BasicQuestionsComponent } from './basic-questions/basic-questions.component';
import { ChatComponent } from './chat/chat.component';
import { DashboardComponent } from './dashboard/dashboard.component';

export const routes: Routes = [
    {path:'',component: LoginComponent},
    { path: 'welcome', component: WelcomeComponent },
    { path: 'mood-questionnaire', component:  QuestionnaireComponent},
    { path: 'basic-questions', component: BasicQuestionsComponent },
    { path: 'chat', component: ChatComponent },
    { path: 'dashboard', component: DashboardComponent }

];
