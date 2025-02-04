;; -*- lexical-binding: t; -*-
(setq inhibit-startup-message t)

;; Profile emacs startup
(setq gc-cons-threshold (* 128 1024 1024)) ;; Set GC threshold to 128MB
(add-hook 'emacs-startup-hook
	  (lambda ()
	    (message "*** Emacs loaded in %s seconds with %d garbage collections."
		     (emacs-init-time "%.2f")
		     gcs-done)))

(scroll-bar-mode -1) ;; Disable visible scrollbar
(tool-bar-mode -1)   ;; Disable the toolbar
(tooltip-mode -1)    ;; Disable tooltips
(set-fringe-mode 20) ;; Give some breathing room
(menu-bar-mode -1)   ;; Disable the menu bar

(setq scroll-conservatively 101) ;; Makes it so that auto scroll doesn't center the cursor
(setq scroll-margin 12) ;; Set auto scroll to trigger when cursor is 8 lines from bottom/top of the window

(set-default-coding-systems 'utf-8)

;; Line numbers
(global-display-line-numbers-mode t)
(setq display-line-numbers-type 'relative)

;; Tab width
(setq-default tab-width 4)

;; Disable line numbers for some modes
(add-hook 'dired-mode-hook (lambda () (display-line-numbers-mode 0)))
(add-hook 'term-mode-hook (lambda () (display-line-numbers-mode 0)))
(add-hook 'shell-mode-hook (lambda () (display-line-numbers-mode 0)))
(add-hook 'eshell-mode-hook (lambda () (display-line-numbers-mode 0)))

;; Set fonts
(set-face-attribute 'default nil :font "HackNerdFontMono" :height 110)
(set-face-attribute 'fixed-pitch nil :font "HackNerdFontMono" :height 110)
(set-face-attribute 'variable-pitch nil :font "HackNerdFont" :height 110)

;; Bootstrap package manager
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

(use-package diminish) ;; Allows hiding modes from mode line
(use-package evil-nerd-commenter) ;; Comment toggle tool
(use-package magit) ;; Git interface

(diminish 'eldoc-mode) ;; Hide ElDoc mode from mode line
(diminish 'auto-revert-mode)

;; Turn off auto fill mode (text hard wrap mode)
(auto-fill-mode 0)

;; Turn on visual line mode (text soft wrap mode)
(global-visual-line-mode 1)
(diminish 'visual-line-mode)

;; Theme
(use-package catppuccin-theme)
(load-theme 'catppuccin t)

;; Colorize brackets
(use-package rainbow-delimiters
  :hook (prog-mode . rainbow-delimiters-mode))

;; Popup with available keybinds for current keymap state
(use-package which-key
  :diminish ;; Hide mode from mode line
  :init ;; Before package is loaded
  (setq which-key-idle-delay 1.0)
  :config ;; After package is loaded
  (which-key-mode 1))

;; Undo tree
(use-package undo-tree
  :diminish
  :init
  (setq undo-tree-auto-save-history t)
  (setq undo-tree-history-directory-alist '(("." . "~/.emacs.d/undo-tree"))) ;; Set storage to emacs config directory and save files with their full path as name
  :config
  (global-undo-tree-mode 1))

;; Evil modes for vim-motions
(use-package evil
  :init
  (setq evil-want-integration t)
  (setq evil-want-keybinding nil)
  (setq evil-want-C-u-scroll nil)
  (setq evil-want-Y-yank-to-eol t)
  (setq evil-undo-system 'undo-tree)
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

;;;; Visual line evil integration for undo tree
;;;; evil-next-line and evil-previous-line are remapped by evil-collection, but visual-line motion commands are not
(keymap-set undo-tree-visualizer-mode-map "<remap> <evil-next-visual-line>" 'undo-tree-visualize-redo)
(keymap-set undo-tree-visualizer-mode-map "<remap> <evil-previous-visual-line>" 'undo-tree-visualize-undo)

;;;; Make C-g return evil to normal state
(define-key evil-insert-state-map (kbd "C-g") 'evil-normal-state)
(define-key evil-operator-state-map (kbd "C-g") 'evil-normal-state)
(define-key evil-replace-state-map (kbd "C-g") 'evil-normal-state)

;;;; Make C-c return evil to normal state
(define-key evil-insert-state-map (kbd "C-c") 'evil-normal-state)
(define-key evil-emacs-state-map (kbd "C-c") 'evil-normal-state)
(define-key evil-operator-state-map (kbd "C-c") 'evil-normal-state)
(define-key evil-replace-state-map (kbd "C-c") 'evil-normal-state)

;; Modify surrounding with evil
(use-package evil-surround
  :diminish
  :config
  (global-evil-surround-mode 1))

;; Pairs
(use-package smartparens
  :diminish
  :hook
  (prog-mode . smartparens-mode)
  (text-mode . smartparens-mode)
  :config
  (require 'smartparens-config))

;; Interactive function to open the init.el config file
(defun kssidll/buffer-open-init-file ()
  "Calls find-file to emacs init.el config file"
  (interactive)
  (find-file "~/.config/nix/modules/editor/emacs/emacs.d/init.el"))

;; Fix my slow fingers when saving/quitting vim style
;; TODO define as Ex mode command, not as an interactive function
(defun W () (interactive) (save-buffer))
(defun Wq () (interactive) (evil-save-and-quit))
(defun WQ() (interactive) (evil-save-and-quit))
(defun Q () (interactive) (evil-quit))

;; Clean whitespace on edited lines automatically
(use-package ws-butler
  :diminish
  :hook (prog-mode . ws-butler-mode))

;; Incremental search autocompletion framework
(use-package ivy
  :diminish
  :bind (:map ivy-minibuffer-map
	      ("TAB" . ivy-alt-done)
	      ("C-n" . ivy-next-line)
	      ("C-p" . ivy-previous-line))
  :config
  (ivy-mode 1))

;; Incremental search with minibuffer preview
(use-package swiper
  :bind (([remap evil-search-forward] . swiper)
	 ([remap evil-search-backward] . swiper-backward)))

;; Suite of ivy replacement functions with (usually) improved functionality
(use-package counsel
  :bind (("M-x" . counsel-M-x)
	 ("C-x b" . counsel-ibuffer)
	 ([remap describe-function] . counsel-describe-function)
	 ([remap describe-variable] . counsel-describe-variable)
	 :map minibuffer-local-map
	 ("C-r" . 'counsel-minibuffer-history))
  :config
  (setq ivy-initial-inputs-alist nil))

;; Ivy enhancements
(use-package ivy-rich
  :config
  (ivy-rich-mode 1))

;; Better description functions
(use-package helpful
  :after counsel
  :custom
  (counsel-describe-function-function #'helpful-callable)
  (counsel-describe-variable-function #'helpful-variable)
  :bind
  ([remap describe-command] . helpful-command)
  ([remap describe-key] . helpful-key))

;; Project management
(use-package counsel-projectile
  :diminish
  :config
  (counsel-projectile-mode 1)
  :init
  (setq counsel-projectile-switch-project-action
	'(4
	  ("o" counsel-projectile-switch-project-action "jump to a project buffer or file")
	  ("f" counsel-projectile-switch-project-action-find-file "jump to a project file")
	  ("d" counsel-projectile-switch-project-action-find-dir "jump to a project directory")
	  ("D" counsel-projectile-switch-project-action-dired "open project in dired")
	  ("b" counsel-projectile-switch-project-action-switch-to-buffer "jump to a project buffer")
	  ("m" counsel-projectile-switch-project-action-find-file-manually "find file manually from project root")
	  ("S" counsel-projectile-switch-project-action-save-all-buffers "save all project buffers")
	  ("k" counsel-projectile-switch-project-action-kill-buffers "kill all project buffers")
	  ("K" counsel-projectile-switch-project-action-remove-known-project "remove project from known projects")
	  ("c" counsel-projectile-switch-project-action-compile "run project compilation command")
	  ("C" counsel-projectile-switch-project-action-configure "run project configure command")
	  ("E" counsel-projectile-switch-project-action-edit-dir-locals "edit project dir-locals")
	  ("v" counsel-projectile-switch-project-action-vc "open project in vc-dir / magit / monky")
	  ("sg" counsel-projectile-switch-project-action-grep "search project with grep")
	  ("si" counsel-projectile-switch-project-action-git-grep "search project with git grep")
	  ("ss" counsel-projectile-switch-project-action-ag "search project with ag")
	  ("sr" counsel-projectile-switch-project-action-rg "search project with rg")
	  ("xs" counsel-projectile-switch-project-action-run-shell "invoke shell from project root")
	  ("xe" counsel-projectile-switch-project-action-run-eshell "invoke eshell from project root")
	  ("xt" counsel-projectile-switch-project-action-run-term "invoke term from project root")
	  ("xv" counsel-projectile-switch-project-action-run-vterm "invoke vterm from project root")
	  ("Oc" counsel-projectile-switch-project-action-org-capture "capture into project")
	  ("Oa" counsel-projectile-switch-project-action-org-agenda "open project agenda")))

    (setq projectile-project-search-path
      (list
        "~/dev/personal/projects"
        "~/dev/personal/notes"
        "~/dev/school"
        "~/dev/work")))

;; Org Mode
(defun kssidll/org-mode-setup ()
  (display-line-numbers-mode 0)
  (org-indent-mode 1)
  (diminish 'org-indent-mode)

  (setq line-spacing 0.1)

  (variable-pitch-mode 1)
  (diminish 'variable-pitch-mode)
  (diminish 'buffer-face-mode)

  (visual-fill-column-mode 1)

  (set-face-attribute 'org-document-title nil :inherit 'variable-pitch :weight 'bold :height 1.4)

  (dolist (face '((org-level-1 . 1.3)
		  (org-level-2 . 1.2)
		  (org-level-3 . 1.1)
		  (org-level-4 . 1.05)
		  (org-level-5 . 1.0)
		  (org-level-6 . 1.0)
		  (org-level-7 . 1.0)
		  (org-level-8 . 1.0)))
    (set-face-attribute (car face) nil :inherit 'variable-pitch :weight 'medium :height (cdr face)))

  ;; Ensure that anything that should be fixed-pitch in Org files appears that way
  (set-face-attribute 'org-block nil :foreground nil :inherit 'fixed-pitch)
  (set-face-attribute 'org-table nil  :inherit 'fixed-pitch)
  (set-face-attribute 'org-formula nil  :inherit 'fixed-pitch)
  (set-face-attribute 'org-code nil   :inherit '(shadow fixed-pitch))
  (set-face-attribute 'org-indent nil :inherit '(org-hide fixed-pitch))
  (set-face-attribute 'org-verbatim nil :inherit '(shadow fixed-pitch))
  (set-face-attribute 'org-special-keyword nil :inherit '(font-lock-comment-face fixed-pitch))
  (set-face-attribute 'org-meta-line nil :inherit '(font-lock-comment-face fixed-pitch))
  (set-face-attribute 'org-checkbox nil :inherit 'fixed-pitch))

(use-package org
  :hook (org-mode . kssidll/org-mode-setup)
  :config
  (setq
   ;; Edit settings
   org-src-tab-acts-natively t
   org-edit-src-content-indentation 2
   org-src-preserve-indentation nil
   org-cycle-separator-lines 2
   org-auto-align-tagn nil
   org-tags-column 0
   org-catch-invisible-edits 'show-and-error
   org-special-ctrl-a/e t
   org-insert-heading-respect-content t

   ;; Styling
   org-hide-block-startup nil
   org-ellipsis " ?"
   org-hide-emphasis-markers t
   org-src-fontify-natively t
   org-fontify-quote-and-verse-blocks t

   ;; Logging
   org-log-done 'time
   org-log-into-drawer t))

;;;; Org mode styling
(use-package org-modern
  :after org
  :hook
  (org-mode . org-modern-mode)
  (org-agenda-finalize-hook . org-modern-agenda)
  :custom
  (org-modern-label-border 2)
  (org-modern-star '("?" "?" "?" "?" "?" "?" "?"))
  (org-modern-list '((?* . ??)(?+ . ??)(?- . ??)))
  (org-modern-checkbox nil)
  (org-modern-radio-target nil))

;;;; Show emphasis markers when point on affected section
(use-package org-appear
  :after org
  :diminish
  :hook (org-mode . org-appear-mode))

;;;; Template completion
(require 'org-tempo)
(add-to-list 'org-structure-template-alist '("src" . "src"))
(add-to-list 'org-structure-template-alist '("sh" . "src shell"))
(add-to-list 'org-structure-template-alist '("el" . "src emacs-lisp"))
(add-to-list 'org-structure-template-alist '("py" . "src python"))

;;;; Add contents with TOC property to a table of contents
(use-package org-make-toc
  :after org
  :diminish
  :hook (org-mode . org-make-toc-mode))

;; HTML export functions
(use-package htmlize)

;; Mode to imitate variable width text edition area
(use-package visual-fill-column
  :diminish
  :custom
  (visual-fill-column-width 90)
  (visual-fill-column-fringes-outside-margins nil)
  (visual-fill-column-center-text t))

;; LSP integration
(use-package lsp-mode
  :custom
  (lsp-inlay-hint-enable t)
  (lsp-rust-analyzer-cargo-watch-command "clippy")
  :config
  (setq read-process-output-max (* 8 1024 1024)))

(use-package dap-mode) ;; Debug adapter
(use-package flycheck) ;; Diagnostics

;; Snippet template system
(use-package yasnippet
  :hook
  (company-mode . yas-minor-mode))

;;;; Code completion
(use-package company
  :after lsp-mode
  :diminish
  :hook
  (lsp-mode . company-mode)
  (emacs-lisp-mode . company-mode)
  :bind
  (:map company-active-map
	("<tab>" . company-complete-selection))
  (:map lsp-mode-map
	("<tab>" . company-indent-or-complete-common))
  :custom
  (company-tooltip-limit 8)
  (company-tooltip-minimum 4)

  ;; sorting functions, todo test each and decide?
  (company-transformers nil)
  ;; (company-transformers '(company-sort-by-occurrence))
  ;; (company-transformers '(company-sort-by-backend-importance))

  (company-minimum-prefix-length 1)
  (company-idle-delay 0)
  :config
  (add-hook 'emacs-lisp-mode-hook (lambda () (company-mode 1))))

;;;; Sideline with diagnostics messages
(use-package lsp-ui
  :custom
  (lsp-ui-sideline-show-diagnostics t)
  (lsp-ui-sideline-delay 0)
  (lsp-ui-sideline-update-mode 'line))

;;;; Programming modes
(use-package rustic
  :hook (rustic-mode . lsp-mode))

(use-package cargo-mode)

(use-package php-mode
  :hook (php-mode . lsp-mode))

(setq-default go-ts-mode-indent-offset 4)
(use-package go-mode
  :hook (go-mode . lsp-mode))

(use-package kotlin-mode)

;; Keybindings

;;;; Define prefix map
(defvar-keymap space-prefix-map)
(define-key evil-normal-state-map (kbd "SPC") (cons "space prefix" space-prefix-map))
(define-key evil-visual-state-map (kbd "SPC") (cons "space prefix" space-prefix-map))

;;;;;; Fix dired
(add-hook 'dired-mode-hook
	  (lambda ()
	    (define-key dired-mode-map (kbd "SPC") (cons "space prefix" space-prefix-map))
	    (define-key dired-mode-map (kbd "<normal-state> SPC") (cons "space prefix" space-prefix-map))))

;;;; M-x on SPC -> SPC
(define-key space-prefix-map (kbd "SPC") '("M-x" . execute-extended-command))

;;;; Toggle comment lines on gc
(define-key evil-motion-state-map (kbd "gc") '("toggle comment" . evilnc-comment-or-uncomment-lines))

;;;; Define map for file related bindings
(defvar-keymap prefix-f-map)
(define-key space-prefix-map (kbd "f") (cons "file" prefix-f-map))

(define-key prefix-f-map (kbd "f") '("find file" . counsel-find-file))
(define-key prefix-f-map (kbd "s") '("search" . counsel-file-jump))

;;;; Define map for emacs file related bindings
(defvar-keymap prefix-f-e-map)
(define-key prefix-f-map (kbd "e") (cons "emacs" prefix-f-e-map))

(define-key prefix-f-e-map (kbd "d") '("open init config file" . kssidll/buffer-open-init-file))

;;;; Define map for buffer related bindings
(defvar-keymap prefix-b-map)
(define-key space-prefix-map (kbd "b") (cons "buffer" prefix-b-map))

(define-key prefix-b-map (kbd "n") '("next buffer" . next-buffer))
(define-key prefix-b-map (kbd "p") '("previous buffer" . previous-buffer))
(define-key prefix-b-map (kbd "b") '("buffers" . counsel-ibuffer))

;;;; Define map for application related bindings
(defvar-keymap prefix-a-map)
(define-key space-prefix-map (kbd "a") (cons "application" prefix-a-map))

(define-key prefix-a-map (kbd "u") '("visualize undo tree" . undo-tree-visualize))

;;;; Define map for project related bindings
(defvar-keymap prefix-p-map
  :parent projectile-command-map) ;; Inherit from projectile-command-map
(define-key space-prefix-map (kbd "p") (cons "project" prefix-p-map))

(define-key prefix-p-map (kbd "f") '("find file" . projectile-find-file))
(define-key prefix-p-map (kbd "s") '("search" . counsel-projectile-rg))
(define-key prefix-p-map (kbd "g") '("git" . magit-status))

;;;;;; this  should be under file, but i got used to clicking pv, and f is *not* fun to click on dvorak
(define-key prefix-p-map (kbd "v") '("file dired" . dired-jump))
