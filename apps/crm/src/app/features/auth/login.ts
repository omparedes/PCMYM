import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, required, email, FormField } from '@angular/forms/signals';
import { InputText } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { AuthService } from '../../core/auth/auth.service';

// Login placeholder (Fase 0): demuestra el patrón signal-first con Signal Forms,
// PrimeNG y Supabase Auth. No es el formulario definitivo.
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, InputText, ButtonModule, MessageModule],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly model = signal({ email: '', password: '' });

  protected readonly loginForm = form(this.model, (path) => {
    required(path.email);
    email(path.email);
    required(path.password);
  });

  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  protected async onSubmit(): Promise<void> {
    this.errorMsg.set(null);
    if (!this.loginForm().valid()) return;

    this.loading.set(true);
    const { email, password } = this.model();
    const { error } = await this.auth.signInWithPassword(email, password);
    this.loading.set(false);

    if (error) {
      this.errorMsg.set(error.message);
      return;
    }
    void this.router.navigateByUrl('/service-orders');
  }
}
