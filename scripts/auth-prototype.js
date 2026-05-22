(function () {
  const API_BASE_URL = "http://localhost:5000/api";
  var visibleClass = "is-visible";
  var hideDelay = 2600;
  var transitionDelay = 220;
  var endpointMissingMessage = "L\u2019inscription centre partenaire n\u00e9cessite encore l\u2019endpoint backend d\u00e9di\u00e9.";
  var stepGuardMessage = "Veuillez compl\u00e9ter l\u2019\u00e9tape actuelle avant de continuer.";
  var servicesErrorMessage = "Impossible de charger les services. V\u00e9rifiez que le backend est lanc\u00e9.";
  var servicesEmptyMessage = "Aucun service disponible pour le moment.";

  function showToast(toast) {
    window.clearTimeout(toast.authPrototypeTimer);
    window.clearTimeout(toast.authPrototypeHideTimer);

    toast.hidden = false;
    window.requestAnimationFrame(function () {
      toast.classList.add(visibleClass);
    });

    toast.authPrototypeTimer = window.setTimeout(function () {
      toast.classList.remove(visibleClass);
      toast.authPrototypeHideTimer = window.setTimeout(function () {
        toast.hidden = true;
      }, transitionDelay);
    }, hideDelay);
  }

  function initAuthToast() {
    document.querySelectorAll(".auth-prototype").forEach(function (page) {
      var toast = page.querySelector(".auth-prototype__toast");

      if (!toast) {
        return;
      }

      page.querySelectorAll(".auth-prototype__form").forEach(function (form) {
        if (form.dataset.authFlow === "garage") {
          return;
        }

        form.noValidate = true;

        form.addEventListener("submit", function (event) {
          event.preventDefault();

          if (form.dataset.authFlow === "login" && !validateLoginForm(form)) {
            return;
          }

          if (form.dataset.authFlow === "client" && !validateClientRegisterForm(form)) {
            return;
          }

          showToast(toast);
        });
      });
    });
  }

  function initRegisterRoleSwitch() {
    document.querySelectorAll(".auth-prototype--register").forEach(function (page) {
      var roleControls = page.querySelectorAll("[data-register-role]");
      var panels = page.querySelectorAll("[data-register-panel]");

      function setRole(role) {
        roleControls.forEach(function (control) {
          var isActive = control.dataset.registerRole === role;
          var roleCard = control.classList.contains("auth-prototype__role-card")
            ? control
            : control.closest(".auth-prototype__mobile-role");

          if (control.type === "radio") {
            control.checked = isActive;
          } else {
            control.setAttribute("aria-pressed", String(isActive));
          }

          if (roleCard && roleCard.classList.contains("auth-prototype__role-card")) {
            roleCard.classList.toggle("auth-prototype__role-card--active", isActive);
          }
        });

        panels.forEach(function (panel) {
          panel.hidden = panel.dataset.registerPanel !== role;
        });
      }

      roleControls.forEach(function (control) {
        var eventName = control.type === "radio" ? "change" : "click";
        control.addEventListener(eventName, function () {
          setRole(control.dataset.registerRole);
        });
      });

      setRole("client");
    });
  }

  function initGarageWizard() {
    document.querySelectorAll("[data-garage-wizard]").forEach(function (wizard) {
      var currentStep = 1;
      var maxUnlockedStep = 1;
      var nextButton = wizard.querySelector("[data-step-next]");
      var prevButton = wizard.querySelector("[data-step-prev]");

      setWizardStep(wizard, currentStep, maxUnlockedStep);

      wizard.querySelectorAll("[data-step-jump]").forEach(function (button) {
        button.addEventListener("click", function () {
          var targetStep = Number(button.dataset.stepJump);

          if (targetStep === currentStep) {
            return;
          }

          if (targetStep > currentStep && !validateStepsBefore(wizard, targetStep, stepGuardMessage)) {
            return;
          }

          currentStep = targetStep;
          maxUnlockedStep = Math.max(maxUnlockedStep, currentStep);

          if (currentStep === 4) {
            updateGarageSummary(wizard);
          }

          setWizardStep(wizard, currentStep, maxUnlockedStep);
        });
      });

      if (nextButton) {
        nextButton.addEventListener("click", function () {
          if (!validateGarageStep(wizard, currentStep)) {
            return;
          }

          currentStep += 1;
          maxUnlockedStep = Math.max(maxUnlockedStep, currentStep);

          if (currentStep === 4) {
            updateGarageSummary(wizard);
          }

          setWizardStep(wizard, currentStep, maxUnlockedStep);
        });
      }

      if (prevButton) {
        prevButton.addEventListener("click", function () {
          currentStep = Math.max(1, currentStep - 1);
          setWizardStep(wizard, currentStep, maxUnlockedStep);
        });
      }

      wizard.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!validateGarageStep(wizard, 4)) {
          return;
        }

        var garagePayload = buildGaragePayload(wizard);
        void garagePayload;

        var endpointMessage = wizard.querySelector("[data-endpoint-message]");
        if (endpointMessage) {
          endpointMessage.textContent = endpointMissingMessage;
          endpointMessage.hidden = false;
        }
      });
    });
  }

  function ensureServicesLoaded(wizard) {
    if (wizard.dataset.servicesLoaded === "true" || wizard.dataset.servicesLoading === "true") {
      return;
    }

    loadServices(wizard);
  }

  function loadServices(wizard) {
    var list = wizard.querySelector("[data-services-list]");

    wizard.dataset.servicesLoading = "true";
    delete wizard.dataset.servicesError;
    delete wizard.dataset.servicesLoaded;
    setServicesState(wizard, "loading");
    renderServices(wizard, []);

    fetch(API_BASE_URL + "/services")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("services_request_failed");
        }

        return response.json();
      })
      .then(function (payload) {
        if (!payload || payload.success !== true) {
          throw new Error("services_response_failed");
        }

        var services = extractServices(payload.data);

        if (!Array.isArray(services)) {
          throw new Error("services_shape_invalid");
        }

        if (!services.length) {
          wizard.dataset.servicesLoaded = "true";
          renderServices(wizard, []);
          setServicesState(wizard, "empty");
          return;
        }

        wizard.dataset.servicesLoaded = "true";
        renderServices(wizard, services);
        setServicesState(wizard, "ready");
      })
      .catch(function () {
        delete wizard.dataset.servicesLoaded;
        wizard.dataset.servicesError = "true";
        if (list) {
          list.innerHTML = "";
        }
        setServicesState(wizard, "error");
      })
      .finally(function () {
        delete wizard.dataset.servicesLoading;
      });
  }

  function extractServices(data) {
    var source = null;

    if (Array.isArray(data)) {
      source = data;
    } else if (data && Array.isArray(data.services)) {
      source = data.services;
    } else if (data && Array.isArray(data.data)) {
      source = data.data;
    } else if (data && typeof data === "object") {
      source = Object.values(data).find(function (value) {
        return Array.isArray(value);
      }) || null;
    }

    if (!Array.isArray(source)) {
      return null;
    }

    return source.map(normalizeService).filter(Boolean);
  }

  function normalizeService(service) {
    if (!service || typeof service !== "object") {
      return null;
    }

    var isUnavailable = service.active === false || service.is_active === false || service.available === false || service.status === "inactive";

    if (isUnavailable) {
      return null;
    }

    var id = service.service_id || service.id || service.serviceId;
    var name = service.name || service.service_name || service.label || service.title;

    if (id === undefined || id === null || !name) {
      return null;
    }

    return {
      id: id,
      name: String(name),
      description: service.description ? String(service.description) : ""
    };
  }

  function renderServices(wizard, services) {
    var list = wizard.querySelector("[data-services-list]");

    if (!list) {
      return;
    }

    list.innerHTML = "";

    services.forEach(function (service) {
      list.appendChild(createServiceRow(service));
    });
  }

  function createServiceRow(service) {
    var row = document.createElement("label");
    row.className = "auth-prototype__service-row";

    var main = document.createElement("span");
    main.className = "auth-prototype__service-main";

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.serviceCheckbox = "";
    checkbox.dataset.serviceId = String(service.id);
    checkbox.dataset.serviceName = service.name;

    var copy = document.createElement("span");
    copy.className = "auth-prototype__service-copy";

    var title = document.createElement("span");
    title.textContent = service.name;
    copy.appendChild(title);

    if (service.description) {
      var description = document.createElement("span");
      description.className = "auth-prototype__service-description";
      description.textContent = service.description;
      copy.appendChild(description);
    }

    main.appendChild(checkbox);
    main.appendChild(copy);

    var tariffField = document.createElement("span");
    tariffField.className = "auth-prototype__tariff-field";
    tariffField.dataset.priceField = "";
    tariffField.hidden = true;

    var priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "1";
    priceInput.step = "0.01";
    priceInput.dataset.priceInput = "";
    priceInput.setAttribute("aria-label", "Tarif " + service.name);

    var euro = document.createElement("span");
    euro.setAttribute("aria-hidden", "true");
    euro.textContent = "\u20ac";

    tariffField.appendChild(priceInput);
    tariffField.appendChild(euro);

    checkbox.addEventListener("change", function () {
      row.classList.toggle("is-selected", checkbox.checked);
      tariffField.hidden = !checkbox.checked;

      if (!checkbox.checked) {
        priceInput.value = "";
        priceInput.removeAttribute("aria-invalid");
      }
    });

    row.appendChild(main);
    row.appendChild(tariffField);

    return row;
  }

  function setServicesState(wizard, state) {
    var loading = wizard.querySelector("[data-services-loading]");
    var error = wizard.querySelector("[data-services-error]");
    var empty = wizard.querySelector("[data-services-empty]");
    var list = wizard.querySelector("[data-services-list]");

    if (loading) {
      loading.hidden = state !== "loading";
    }

    if (error) {
      error.textContent = servicesErrorMessage;
      error.hidden = state !== "error";
    }

    if (empty) {
      empty.textContent = servicesEmptyMessage;
      empty.hidden = state !== "empty";
    }

    if (list) {
      list.hidden = state !== "ready";
    }
  }

  function validateLoginForm(form) {
    var email = getFormControl(form, "email");
    var password = getFormControl(form, "password");

    clearFormError(form);

    if (!getControlValue(email)) {
      return showFormError(form, "Veuillez saisir votre email.", [email]);
    }

    if (!isEmail(getControlValue(email))) {
      return showFormError(form, "Veuillez saisir un email valide.", [email]);
    }

    if (!getControlValue(password)) {
      return showFormError(form, "Veuillez saisir votre mot de passe.", [password]);
    }

    return true;
  }

  function validateClientRegisterForm(form) {
    var fullName = getFormControl(form, "fullName");
    var email = getFormControl(form, "email");
    var phone = getFormControl(form, "phone");
    var password = getFormControl(form, "password");
    var confirmPassword = getFormControl(form, "confirmPassword");
    var terms = getFormControl(form, "terms");

    clearFormError(form);

    if (
      !getControlValue(fullName) ||
      !getControlValue(email) ||
      !getControlValue(phone) ||
      !getControlValue(password) ||
      !getControlValue(confirmPassword)
    ) {
      return showFormError(form, "Veuillez remplir tous les champs obligatoires.", [
        fullName,
        email,
        phone,
        password,
        confirmPassword
      ].filter(function (control) {
        return !getControlValue(control);
      }));
    }

    if (!isEmail(getControlValue(email))) {
      return showFormError(form, "Veuillez saisir un email valide.", [email]);
    }

    if (getControlValue(password).length < 8) {
      return showFormError(form, "Le mot de passe doit contenir au moins 8 caract\u00e8res.", [password]);
    }

    if (getControlValue(password) !== getControlValue(confirmPassword)) {
      return showFormError(form, "Les mots de passe ne correspondent pas.", [password, confirmPassword]);
    }

    if (!terms || !terms.checked) {
      return showFormError(form, "Veuillez accepter les conditions d\u2019utilisation.", [terms]);
    }

    return true;
  }

  function setWizardStep(wizard, step, maxUnlockedStep) {
    wizard.querySelectorAll("[data-step]").forEach(function (panel) {
      var isActive = Number(panel.dataset.step) === step;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });

    wizard.querySelectorAll("[data-step-indicator]").forEach(function (indicator) {
      var indicatorStep = Number(indicator.dataset.stepIndicator);
      var button = indicator.querySelector("[data-step-jump]");
      var isActive = indicatorStep === step;
      var isCompleted = indicatorStep < step;
      var isLocked = indicatorStep > maxUnlockedStep;

      indicator.classList.toggle("is-active", isActive);
      indicator.classList.toggle("is-completed", isCompleted);
      indicator.classList.toggle("is-locked", isLocked);

      if (button) {
        button.setAttribute("aria-current", isActive ? "step" : "false");
        button.setAttribute("aria-disabled", String(isLocked));
      }
    });

    var nextButton = wizard.querySelector("[data-step-next]");
    var prevButton = wizard.querySelector("[data-step-prev]");
    var submitButton = wizard.querySelector("[data-garage-submit]");
    var endpointMessage = wizard.querySelector("[data-endpoint-message]");

    if (prevButton) {
      prevButton.hidden = step === 1;
    }

    if (nextButton) {
      nextButton.hidden = step === 4;
    }

    if (submitButton) {
      submitButton.hidden = step !== 4;
    }

    if (endpointMessage && step !== 4) {
      endpointMessage.hidden = true;
    }

    if (step === 3) {
      ensureServicesLoaded(wizard);
    }

    clearWizardError(wizard);
  }

  function validateStepsBefore(wizard, targetStep, messageOverride) {
    for (var step = 1; step < targetStep; step += 1) {
      if (!validateGarageStep(wizard, step, messageOverride)) {
        return false;
      }
    }

    clearWizardError(wizard);
    return true;
  }

  function validateGarageStep(wizard, step, messageOverride) {
    clearWizardError(wizard);
    clearInvalidFields(wizard);

    if (step === 1) {
      var stepOneFields = ["first_name", "last_name", "email", "phone", "password", "confirm_password"];

      if (!hasValues(wizard, stepOneFields)) {
        return setWizardError(wizard, messageOverride || "Veuillez remplir tous les champs obligatoires.", getEmptyFields(wizard, stepOneFields));
      }

      if (!isEmail(getFieldValue(wizard, "email"))) {
        return setWizardError(wizard, messageOverride || "Veuillez saisir un email valide.", [getFieldControl(wizard, "email")]);
      }

      if (getFieldValue(wizard, "password").length < 8) {
        return setWizardError(wizard, messageOverride || "Veuillez remplir tous les champs obligatoires.", [getFieldControl(wizard, "password")]);
      }

      if (getFieldValue(wizard, "password") !== getFieldValue(wizard, "confirm_password")) {
        return setWizardError(wizard, messageOverride || "Les mots de passe ne correspondent pas.", [
          getFieldControl(wizard, "password"),
          getFieldControl(wizard, "confirm_password")
        ]);
      }
    }

    if (step === 2) {
      var stepTwoFields = ["garage_name", "garage_address", "garage_postal_code", "garage_city", "garage_phone", "garage_email"];

      if (!hasValues(wizard, stepTwoFields)) {
        return setWizardError(wizard, messageOverride || "Veuillez remplir tous les champs obligatoires.", getEmptyFields(wizard, stepTwoFields));
      }

      if (!/^\d{5}$/.test(getFieldValue(wizard, "garage_postal_code"))) {
        return setWizardError(wizard, messageOverride || "Le code postal doit contenir 5 chiffres.", [getFieldControl(wizard, "garage_postal_code")]);
      }

      if (!isEmail(getFieldValue(wizard, "garage_email"))) {
        return setWizardError(wizard, messageOverride || "Veuillez saisir un email valide.", [getFieldControl(wizard, "garage_email")]);
      }
    }

    if (step === 3) {
      if (wizard.dataset.servicesLoading === "true") {
        return setWizardError(wizard, "Chargement des services...");
      }

      if (wizard.dataset.servicesError === "true") {
        return setWizardError(wizard, servicesErrorMessage);
      }

      if (wizard.dataset.servicesLoaded !== "true" || !wizard.querySelector("[data-service-checkbox]")) {
        return setWizardError(wizard, servicesEmptyMessage);
      }

      var tariffs = getSelectedTariffs(wizard);

      if (!tariffs.length) {
        return setWizardError(wizard, messageOverride || "Veuillez s\u00e9lectionner au moins un service.");
      }

      if (tariffs.some(function (tariff) { return !isPositiveNumber(tariff.price); })) {
        return setWizardError(wizard, messageOverride || "Veuillez saisir un tarif valide.", getInvalidPriceInputs(wizard));
      }
    }

    if (step === 4) {
      var terms = wizard.querySelector("[data-field='terms']");

      if (!terms || !terms.checked) {
        return setWizardError(wizard, messageOverride || "Veuillez remplir tous les champs obligatoires.", [terms]);
      }
    }

    return true;
  }

  function buildGaragePayload(wizard) {
    return {
      user: {
        first_name: getFieldValue(wizard, "first_name"),
        last_name: getFieldValue(wizard, "last_name"),
        email: getFieldValue(wizard, "email"),
        phone: getFieldValue(wizard, "phone"),
        password: getFieldValue(wizard, "password"),
        role: "garage"
      },
      garage: {
        name: getFieldValue(wizard, "garage_name"),
        address: getFieldValue(wizard, "garage_address"),
        postal_code: getFieldValue(wizard, "garage_postal_code"),
        city: getFieldValue(wizard, "garage_city"),
        phone: getFieldValue(wizard, "garage_phone"),
        email: getFieldValue(wizard, "garage_email"),
        description: getFieldValue(wizard, "garage_description")
      },
      tariffs: getSelectedTariffs(wizard).map(function (tariff) {
        return {
          service_id: tariff.service_id,
          price: tariff.price
        };
      })
    };
  }

  function updateGarageSummary(wizard) {
    setSummaryText(
      wizard,
      "responsable",
      getFieldValue(wizard, "first_name") + " " + getFieldValue(wizard, "last_name") + " - " + getFieldValue(wizard, "email")
    );
    setSummaryText(
      wizard,
      "centre",
      getFieldValue(wizard, "garage_name") + " - " + getFieldValue(wizard, "garage_postal_code") + " " + getFieldValue(wizard, "garage_city")
    );

    var tariffs = getSelectedTariffs(wizard);
    setSummaryText(wizard, "services", tariffs.map(function (tariff) { return tariff.name; }).join(", ") || "-");
    setSummaryText(
      wizard,
      "tariffs",
      tariffs.map(function (tariff) { return tariff.name + " : " + tariff.price + " \u20ac"; }).join(" / ") || "-"
    );
  }

  function showFormError(form, message, controls) {
    var error = getOrCreateFormError(form);

    error.textContent = message;
    error.hidden = false;

    controls.forEach(markControlInvalid);

    return false;
  }

  function clearFormError(form) {
    var error = form.querySelector("[data-form-error]");

    if (error) {
      error.textContent = "";
      error.hidden = true;
    }

    clearInvalidFields(form);
  }

  function getOrCreateFormError(form) {
    var error = form.querySelector("[data-form-error]");

    if (!error) {
      error = document.createElement("p");
      error.className = "auth-prototype__form-error";
      error.setAttribute("data-form-error", "");
      error.setAttribute("role", "alert");
      error.hidden = true;
      form.prepend(error);
    }

    return error;
  }

  function setWizardError(wizard, message, controls) {
    var error = wizard.querySelector("[data-wizard-error]");

    if (error) {
      error.textContent = message;
      error.hidden = false;
    }

    (controls || []).forEach(markControlInvalid);

    return false;
  }

  function clearWizardError(wizard) {
    var error = wizard.querySelector("[data-wizard-error]");

    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }

  function clearInvalidFields(root) {
    root.querySelectorAll(".is-invalid").forEach(function (field) {
      field.classList.remove("is-invalid");
    });

    root.querySelectorAll("[aria-invalid='true']").forEach(function (control) {
      control.removeAttribute("aria-invalid");
    });
  }

  function markControlInvalid(control) {
    if (!control) {
      return;
    }

    control.setAttribute("aria-invalid", "true");

    var field = control.closest(".auth-prototype__field") || control.closest(".auth-prototype__checkbox-row") || control.closest(".auth-prototype__tariff-field");

    if (field) {
      field.classList.add("is-invalid");
    }
  }

  function setSummaryText(wizard, key, text) {
    var target = wizard.querySelector("[data-summary='" + key + "']");

    if (target) {
      target.textContent = text;
    }
  }

  function hasValues(wizard, fields) {
    return fields.every(function (field) {
      return getFieldValue(wizard, field).length > 0;
    });
  }

  function getEmptyFields(wizard, fields) {
    return fields.map(function (field) {
      return getFieldControl(wizard, field);
    }).filter(function (control) {
      return !getControlValue(control);
    });
  }

  function getInvalidPriceInputs(wizard) {
    return getSelectedTariffs(wizard).filter(function (tariff) {
      return !isPositiveNumber(tariff.price);
    }).map(function (tariff) {
      return tariff.priceInput;
    });
  }

  function getFieldValue(wizard, field) {
    return getControlValue(getFieldControl(wizard, field));
  }

  function getFieldControl(wizard, field) {
    return wizard.querySelector("[data-field='" + field + "']");
  }

  function getFormControl(form, name) {
    return form.elements[name] || form.querySelector("[name='" + name + "']");
  }

  function getControlValue(control) {
    return control && typeof control.value === "string" ? control.value.trim() : "";
  }

  function getSelectedTariffs(wizard) {
    return Array.prototype.slice.call(wizard.querySelectorAll("[data-service-checkbox]:checked")).map(function (checkbox) {
      var row = checkbox.closest(".auth-prototype__service-row");
      var priceInput = row ? row.querySelector("[data-price-input]") : null;

      return {
        service_id: Number(checkbox.dataset.serviceId),
        name: checkbox.dataset.serviceName,
        price: priceInput ? Number(priceInput.value) : 0,
        priceInput: priceInput
      };
    });
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isPositiveNumber(value) {
    return Number.isFinite(value) && value > 0;
  }

  initAuthToast();
  initRegisterRoleSwitch();
  initGarageWizard();
})();
