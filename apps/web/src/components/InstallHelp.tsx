export function InstallHelp() {
  return (
    <details className="install-help" data-testid="install-help">
      <summary>Install troubleshooting (Android)</summary>
      <p className="small">
        If Chrome says STRATEGOS is <strong>already installed</strong> but you see no
        home-screen icon:
      </p>
      <ol className="small">
        <li>
          Open your <strong>app drawer</strong> (swipe up on the home screen) and search
          for STRATEGOS. Chrome often installs there without adding a home-screen icon;
          long-press it → <em>Add to Home screen</em>.
        </li>
        <li>
          If it is not there, open <strong>Settings → Apps</strong>, find STRATEGOS
          (a stale copy from an earlier install), and <strong>Uninstall</strong> it.
        </li>
        <li>
          Return to Chrome, reload this page, then use <em>Install app</em> above
          or Chrome menu (⋮) → <em>Install app</em>.
        </li>
      </ol>
      <p className="muted small">
        Uninstalling the app copy may also remove its stored data. Export your learning
        data first if you have any.
      </p>
    </details>
  );
}
