(function (App) {
  if (!App) return;

  const {
    onReady,
    ENDPOINTS,
    apiRequest,
    showAlert,
    setSession,
    setFlashMessage,
    redirectToLogin
  } = App;

  function updatePasswordStrength(input, bar) {
    if (!input || !bar) return;
    const val = input.value || '';
    let score = 0;
    if (val.length >= 8) score += 25;
    if (/[A-Z]/.test(val)) score += 25;
    if (/[0-9]/.test(val)) score += 25;
    if (/[^A-Za-z0-9]/.test(val)) score += 25;
    bar.style.width = `${score}%`;
    bar.style.backgroundColor = score < 50 ? '#dc3545' : score < 75 ? '#ffc107' : '#28a745';
  }

  onReady(() => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('email')?.value.trim() || '';
        const senha = document.getElementById('senha')?.value || '';

        if (!email || !senha) {
          showAlert(loginForm, 'warning', 'Informe e-mail e senha.');
          return;
        }

        try {
          const data = await apiRequest(ENDPOINTS.login, {
            method: 'POST',
            body: { email, senha },
            skipAuth: true
          });
          if (data?.token) {
            setSession(data.token, data.user || null);
          }
          window.location.href = 'perfil.html';
        } catch (err) {
          console.error('[login] erro', err);
          const message = err.data?.error || 'Falha no login. Verifique suas credenciais.';
          showAlert(loginForm, 'danger', message);
        }
      });
    }
  });

  onReady(() => {
    const form = document.getElementById('registerForm');
    if (!form) return;
    const senha = document.getElementById('senha');
    const confirmar = document.getElementById('confirmacaoSenha') || document.getElementById('confirmarSenha');
    const bar = document.getElementById('passwordStrengthBar');

    senha?.addEventListener('input', () => updatePasswordStrength(senha, bar));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nome = document.getElementById('nome')?.value || '';
      const sobrenome = document.getElementById('sobrenome')?.value || '';
      const email = document.getElementById('email')?.value || '';
      const senhaVal = senha?.value || '';
      const confirmarVal = confirmar?.value || '';

      if (senhaVal !== confirmarVal) {
        showAlert(form, 'warning', 'As senhas não conferem.');
        return;
      }

      try {
        await apiRequest(ENDPOINTS.register, {
          method: 'POST',
          body: {
            nome,
            sobrenome,
            email,
            senha: senhaVal
          },
          skipAuth: true
        });
        showAlert(form, 'success', 'Cadastro concluído! Agora você pode fazer login.');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1200);
      } catch (err) {
        console.error('[register] erro', err);
        const message = err.data?.error || 'Não foi possível concluir o cadastro.';
        showAlert(form, 'danger', message);
      }
    });
  });

  onReady(() => {
    const requestSection = document.getElementById('forgotPasswordRequest');
    const resetSection = document.getElementById('forgotPasswordReset');
    const successSection = document.getElementById('forgotPasswordSuccess');

    if (!requestSection && !resetSection && !successSection) return;

    const requestForm = document.getElementById('forgotPasswordRequestForm');
    const resetForm = document.getElementById('forgotPasswordResetForm');
    const successMessage = document.getElementById('forgotPasswordSuccessMessage');
    const titleEl = document.getElementById('forgotPasswordTitle');
    const subtitleEl = document.getElementById('forgotPasswordSubtitle');
    const emailInput = document.getElementById('forgotPasswordEmail');
    const senhaInput = document.getElementById('resetPasswordSenha');
    const confirmInput = document.getElementById('resetPasswordConfirmacao');

    const params = new URLSearchParams(window.location.search);
    const state = {
      token: (params.get('token') || '').trim()
    };

    const sections = {
      request: requestSection,
      reset: resetSection,
      success: successSection
    };

    function toggleStep(step) {
      Object.entries(sections).forEach(([key, element]) => {
        if (!element) return;
        element.classList.toggle('d-none', key !== step);
      });
    }

    function updateHeader(title, subtitle) {
      if (titleEl && title) {
        titleEl.textContent = title;
      }
      if (!subtitleEl) return;
      if (subtitle) {
        subtitleEl.textContent = subtitle;
        subtitleEl.classList.remove('d-none');
      } else {
        subtitleEl.classList.add('d-none');
      }
    }

    function toggleFormSubmitting(form, isSubmitting, loadingLabel) {
      if (!form) return;
      const button = form.querySelector('button[type="submit"]');
      if (!button) return;
      if (isSubmitting) {
        if (!button.dataset.originalText) {
          button.dataset.originalText = button.textContent ?? '';
        }
        if (loadingLabel) {
          button.textContent = loadingLabel;
        }
        button.setAttribute('disabled', 'disabled');
      } else {
        button.removeAttribute('disabled');
        if (button.dataset.originalText) {
          button.textContent = button.dataset.originalText;
          delete button.dataset.originalText;
        }
      }
    }

    if (state.token) {
      toggleStep('reset');
      updateHeader('Definir nova senha', 'Crie uma nova senha para continuar.');
    } else {
      toggleStep('request');
      updateHeader('Recuperar senha', 'Informe seu e-mail e enviaremos um link para redefinir sua senha.');
    }

    requestForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = emailInput?.value.trim().toLowerCase() || '';
      if (!email) {
        showAlert(requestForm, 'warning', 'Informe um e-mail válido.');
        return;
      }

      toggleFormSubmitting(requestForm, true, 'Enviando...');
      try {
        await apiRequest(ENDPOINTS.forgotPassword, {
          method: 'POST',
          body: { email },
          skipAuth: true
        });
        toggleStep('success');
        if (successMessage) {
          successMessage.textContent = 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.';
        }
      } catch (err) {
        console.error('[forgot-password] erro', err);
        const message = err.data?.error || 'Não foi possível iniciar a recuperação.';
        showAlert(requestForm, 'danger', message);
      } finally {
        toggleFormSubmitting(requestForm, false);
      }
    });

    resetForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const senha = senhaInput?.value || '';
      const confirmar = confirmInput?.value || '';

      if (!senha || senha.length < 8) {
        showAlert(resetForm, 'warning', 'A senha deve conter pelo menos 8 caracteres.');
        return;
      }
      if (senha !== confirmar) {
        showAlert(resetForm, 'warning', 'As senhas não conferem.');
        return;
      }
      if (!state.token) {
        showAlert(resetForm, 'warning', 'Token inválido ou expirado.');
        return;
      }

      toggleFormSubmitting(resetForm, true, 'Atualizando...');
      try {
        await apiRequest(ENDPOINTS.resetPassword, {
          method: 'POST',
          body: { token: state.token, senha },
          skipAuth: true
        });
        setFlashMessage('success', 'Senha atualizada com sucesso. Faça login novamente.');
        redirectToLogin();
      } catch (err) {
        console.error('[reset-password] erro', err);
        const message = err.data?.error || 'Não foi possível redefinir a senha.';
        showAlert(resetForm, 'danger', message);
      } finally {
        toggleFormSubmitting(resetForm, false);
      }
    });
  });
})(window.App);
