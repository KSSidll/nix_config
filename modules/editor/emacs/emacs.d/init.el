;; -*- lexical-binding: t; -*-
(setq inhibit-startup-message t)


;;;; Show debug info on errors
;; (setq debug-on-error t)


;;;; Profile emacs startup
(setq gc-cons-threshold (* 128 1024 1024)) ;; Set GC threshold to 128MB
(add-hook 'emacs-startup-hook
  (lambda ()
    (message "*** Emacs loaded in %s seconds with %d garbage collections."
      (emacs-init-time "%.2f")
      gcs-done)))


;;;; Bootstrap package manager
(unless (featurep 'straight)
  (defvar bootstrap-version)
  (let ((bootstrap-file
     (expand-file-name
      "straight/repos/straight.el/bootstrap.el"
      (or (bound-and-true-p straight-base-dir)
          user-emacs-directory)))
    (bootstrap-version 7))
    (unless (file-exists-p bootstrap-file)
      (with-current-buffer
      (url-retrieve-synchronously
       "https://raw.githubusercontent.com/radian-software/straight.el/develop/install.el"
       'silent 'inhibit-cookies)
    (goto-char (point-max))
    (eval-print-last-sexp)))
    (load bootstrap-file nil 'nomessage)))

(straight-use-package 'use-package) ;; Defer use-package to straight
(setq straight-use-package-by-default t) ;; Download a package if it's not available


;;;; Base config packages / helpers
(use-package eglot)               ;; LSP integration
(use-package diminish)            ;; Allows hiding modes from mode line
(use-package evil-nerd-commenter) ;; Comment toggle tool
(use-package magit)               ;; Git interface
(use-package general)             ;; Keybindings util
(use-package rainbow-delimiters)  ;; Colorize brackets


;;;; Base editor setup
(scroll-bar-mode -1) ;; Disable visible scrollbar
(tool-bar-mode -1)   ;; Disable the toolbar
(tooltip-mode -1)    ;; Disable tooltips
(set-fringe-mode 20) ;; Give some breathing room
(menu-bar-mode -1)   ;; Disable the menu bar

(auto-fill-mode 0)          ;; Turn off hard wrap
(global-visual-line-mode 1) ;; Turn on  soft wrap

(setq scroll-conservatively 101) ;; Makes it so that auto scroll doesn't center the cursor
(setq scroll-margin 12)          ;; Set auto scroll to trigger when cursor is 8 lines from bottom/top of the window

(set-default-coding-systems 'utf-8)
(setopt tab-width 4)
(setopt indent-tabs-mode nil) ;; make tab call indent or insert tab depending on context
(setq indent-line-function 'insert-tab)

(setq display-line-numbers-type 'relative)
(diminish 'visual-line-mode)


;;;; Style

;; Font Laptop
(if (eq system-type 'gnu/linux)
    ((lambda ()
       (set-face-attribute 'default nil :font "HackNerdFontMono" :height 110)
       (set-face-attribute 'fixed-pitch nil :font "HackNerdFontMono" :height 110)
       (set-face-attribute 'variable-pitch nil :font "Hack" :height 110))))

;; Font PC
(if (eq system-type 'windows-nt)
    ((lambda ()
       (set-face-attribute 'default nil :font "Hack NFM" :height 110)
       (set-face-attribute 'fixed-pitch nil :font "Hack NFM" :height 110)
       (set-face-attribute 'variable-pitch nil :font "Hack" :height 110))))

;; Theme
(use-package catppuccin-theme)
(load-theme 'catppuccin t)


;;;; Popup with available keybinds for current keymap state
(use-package which-key
  :diminish ;; Hide mode from mode line
  :init     ;; Before package is loaded
  (setq which-key-idle-delay 1.0)
  :config   ;; After package is loaded
  (which-key-mode 1))


;;;; Better help buffer
(use-package helpful
  :init
  (global-set-key (kbd "C-h f") #'helpful-callable)
  (global-set-key (kbd "C-h v") #'helpful-variable)
  (global-set-key (kbd "C-h k") #'helpful-key)
  (global-set-key (kbd "C-h x") #'helpful-command)
  (global-set-key (kbd "C-h C-d") #'helpful-at-point)
  (global-set-key (kbd "C-h F") #'helpful-function))


;;;; Undo tree
(use-package undo-tree
  :diminish
  :init
  (setq undo-tree-auto-save-history t)
  (setq undo-tree-history-directory-alist '(("." . "~/.emacs.d/undo-tree"))) ;; Set storage to emacs config directory and save files with their full path as name
  :config
  (global-undo-tree-mode 1))


;; Persist history over restarts
(use-package savehist
  :init (savehist-mode 1))


;;;; Evil modes for vim-motions
(use-package evil
  :custom
  (evil-vsplit-window-right t)
  (evil-want-integration t)
  (evil-want-keybinding nil)
  (evil-want-C-u-scroll t)
  (evil-want-Y-yank-to-eol t)
  (evil-undo-system 'undo-tree)
  :config
  (evil-mode 1)
  (evil-global-set-key 'motion "j" 'evil-next-visual-line)
  (evil-global-set-key 'motion "k" 'evil-previous-visual-line))

;; Collection of vim-motion-like definitions for varions modes
(use-package evil-collection
  :after evil
  :custom
  (evil-collection-want-unimpaired-p nil)
  :config
  (evil-collection-init))

;; Visual line evil integration for undo tree
;; evil-next-line and evil-previous-line are remapped by evil-collection, but visual-line motion commands are not
(general-define-key
  :keymaps 'undo-tree-visualizer-mode-map
  "<remap> <evil-next-visual-line>" 'undo-tree-visualize-redo
  "<remap> <evil-previous-visual-line>" 'undo-tree-visualize-undo)

;; Make C-g return evil to normal state
(general-define-key
  :states '(      insert operator replace)
  :keymaps 'override
  "C-g" 'evil-normal-state)

;; Make C-c return evil to normal state
(general-define-key
  :states '(emacs insert operator replace)
  :keymaps 'override
  "C-c" 'evil-normal-state)

;; Comment on gc
(general-define-key
  :states '(visual)
  :keymaps 'override
  "gc" (cons "toggle comment" 'evilnc-comment-or-uncomment-lines))

;; Surround
(use-package evil-surround
  :config (global-evil-surround-mode 1))


;;;; Interactive completion
(use-package vertico
  :init (vertico-mode))

;; Project support
(use-package projectile
  :init
  (defvar projectile-main-project-dir-prefix
    (cond
     ((eq system-type 'gnu/linux) "~/")
     ((eq system-type 'windows-nt) "C:/")))

  (unless (eq projectile-main-project-dir-prefix nil)
    (setq projectile-project-search-path
      (list
       (cons (concat projectile-main-project-dir-prefix "dev/personal/projects") 2)
       (cons (concat projectile-main-project-dir-prefix "dev/personal/notes") 2)
       (cons (concat projectile-main-project-dir-prefix "dev/work") 2)))))


;; Consult for completion navigation
(use-package consult)
(use-package consult-todo)

(defun my/consult-line-with-return ()
  (consult-line)
  (when (and (boundp 'consult--line-history) consult--line-history)
    (car consult--line-history)))

(defun my/consult-line-forward ()
  (interactive)
  (let ((selected (my/consult-line-with-return)))
    (when selected
      (if evil-regexp-search
        (add-to-history 'regexp-search-ring selected)
        (add-to-history 'search-ring selected))
      (setq evil-ex-search-pattern (list selected t t))
      (setq isearch-forward t)
      (setq evil-ex-search-direction 'forward))))

(defun my/consult-line-backward ()
  (interactive)
  (let ((selected (my/consult-line-with-return)))
    (when selected
      (if evil-regexp-search
        (add-to-history 'regexp-search-ring selected)
        (add-to-history 'search-ring selected))
      (setq evil-ex-search-pattern (list selected t t))
      (setq isearch-forward nil)
      (setq evil-ex-search-direction 'backward))))

(general-define-key
  :states '(normal)
  :keymaps 'override
  "/" 'my/consult-line-forward
  "?" 'my/consult-line-backward)

;; Annotations in completion display
(use-package marginalia
  :init (marginalia-mode))

;; Completion search logic
(use-package orderless
  :custom
  (completion-styles '(orderless basic))
  (completion-category-overrides '((file (styles basic partial-completion)))))

;; Emacs minibuffer configurations
(use-package emacs
  :custom
  (context-menu-mode t)
  (enable-recursive-minibuffers t)
  (read-extended-command-predicate #'command-completion-default-include-p)
  (minibuffer-prompt-properties '(read-only t cursor-intangible t face minibuffer-prompt)))


;;;; Pairs
(use-package smartparens
  :diminish
  :config
  (require 'smartparens-config))


;;;; Completion
(use-package company
  :diminish
  :bind
  (:map company-active-map
    ("<tab>" . company-complete-selection))
  :custom
  (company-tooltip-limit 8)
  (company-tooltip-minimum 4)
  (company-transformers '(company-sort-by-backend-importance))
  (company-minimum-prefix-length 1)
  (company-idle-delay 0))


;;;; Keybindings

;; Interactive function to open the init.el config file
(defun my/buffer-open-init-file ()
  "Calls find-file to emacs init.el config file"
  (interactive)
  (find-file "~/.emacs.d/init.el"))

(defun my/window-vsplit-eshell ()
  "Opens an eshell buffer in new window with vsplit"
  (interactive)
  (evil-window-vsplit)
  (eshell))

(general-define-key
  :states '(normal)
  :keymaps 'override
  "C-t" (cons "show eshell in new window" 'my/window-vsplit-eshell))

(general-define-key
  :states '(normal visual)
  :keymaps 'override
  :prefix "SPC"
  ""     '(:ignore t :wk "space prefix")
  "SPC"  (cons "M-x" 'execute-extended-command)

  "f"    '(:ignore t :wk "file")
  "ff"   (cons "find" 'consult-fd)
  "fs"   (cons "search" 'consult-ripgrep)
  "fv"   (cons "dired" 'dired-jump)

  "fe"   '(:ignore t :wk "emacs")
  "fed"  (cons "open init" 'my/buffer-open-init-file)

  "b"    '(:ignore t :wk "buffer")
  "bb"   (cons "buffers" 'consult-buffer-other-window)
  "bn"   (cons "next" 'next-buffer)
  "bp"   (cons "previous" 'previous-buffer)

  "a"    '(:ignore t :wk "application")
  "au"   (cons "visualize undo tree" 'undo-tree-visualize)

  "p"    '(:ignore t :wk "project")
  "pp"   (cons "projects" 'projectile-switch-project)
  "pf"   (cons "find file" 'projectile-find-file)
  "ps"   (cons "search" 'projectile-ripgrep)
  "pg"   (cons "git" 'magit-status))


;;;; Per mode config

;; Display element documentation
(global-eldoc-mode 1)
(diminish 'eldoc-mode)

;; Text modes
(add-hook 'text-mode-hook #'display-line-numbers-mode)
(add-hook 'text-mode-hook #'smartparens-mode)
(add-hook 'text-mode-hook #'company-mode)

;; Programming modes
(add-hook 'prog-mode-hook #'display-line-numbers-mode)
(add-hook 'prog-mode-hook #'rainbow-delimiters-mode)
(add-hook 'prog-mode-hook #'smartparens-mode)
(add-hook 'prog-mode-hook #'company-mode)
(add-hook 'prog-mode-hook #'hl-todo-mode)

; Display whitespace
(setopt whitespace-style '(face tabs spaces trailing indentation space-mark tab-mark))
(setopt whitespace-global-modes '(prog-mode))
(setopt whitespace-display-mappings
  '((space-mark ?\    [?·])
    (space-mark ?\xA0 [?¤])
    (tab-mark   ?\t   [?→ ?\t])))

(with-eval-after-load 'whitespace
  (set-face-attribute 'whitespace-space nil :foreground "grey26" :background nil)
  (set-face-attribute 'whitespace-tab nil :foreground "grey26" :background nil)
  (set-face-attribute 'whitespace-trailing nil :foreground "grey26" :background nil))

(global-whitespace-mode 1)  ;; Auto starts whitespace-mode if in 'whitespace-global-modes
(diminish 'whitespace-mode)

;; Emacs Lisp
(defun my/setup-emacs-lisp-mode ()
  (interactive)
  (setq evil-shift-width 2)
  (setq tab-width 2))
(add-hook 'emacs-lisp-mode-hook 'my/setup-emacs-lisp-mode)

;; C
(defun my/setup-c-mode ()
  (interactive)
  (setq evil-shift-width 2)
  (setq tab-width 2)
  (diminish 'abbrev-mode)
  (diminish 'auto-revert-mode)
  (eglot-ensure))
(add-hook 'c-mode-hook 'my/setup-c-mode)

;; Python
(use-package pyvenv)
(defun my/setup-python-mode ()
  (interactive)
  (setq evil-shift-width 4)
  (setq tab-width 4)
  (diminish 'auto-revert-mode)
  (ignore-errors
    (setenv "WORKON_HOME" (projectile-project-root))
    (pyvenv-workon ".venv"))
  (pyvenv-mode 1)
  (eglot-ensure))
(add-hook 'python-mode-hook 'my/setup-python-mode)


;; Odin
; (with-eval-after-load 'eglot
;   (add-to-list 'eglot-server-programs '((odin-mode) . ("ols"))))
; (add-hook 'odin-mode-hook #'eglot)

;;;; END
