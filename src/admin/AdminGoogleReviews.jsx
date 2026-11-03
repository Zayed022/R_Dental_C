import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Link2, LoaderCircle, RefreshCw, RotateCcw, ShieldCheck, Star, Unlink } from 'lucide-react';
import { api, json } from '../api';

function formatDate(value) {
  if (!value) return 'Not synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not synced yet';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function AdminGoogleReviews({ department = 'dental', notify }) {
  const [status, setStatus] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [accountName, setAccountName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStatus = async () => {
    setError('');
    try {
      const result = await api('/admin/google-reviews/status?department=dental');
      setStatus(result);
      setAccountName(result.accountName || '');
      setLocationName(result.locationName || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, [department]);

  const connect = () => {
    window.location.assign('/api/admin/google-reviews/connect?department=dental');
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setError('');
    try {
      const result = await api('/admin/google-reviews/accounts?department=dental');
      setAccounts(Array.isArray(result.accounts) ? result.accounts : []);
      if (!accountName && result.accounts?.length) setAccountName(result.accounts[0].name);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadLocations = async () => {
    if (!accountName) {
      setError('Choose a Google Business Profile account first.');
      return;
    }
    setLoadingLocations(true);
    setError('');
    try {
      const result = await api(`/admin/google-reviews/locations?department=dental&accountName=${encodeURIComponent(accountName)}`);
      setLocations(Array.isArray(result.locations) ? result.locations : []);
      if (!locationName && result.locations?.length) setLocationName(result.locations[0].name);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingLocations(false);
    }
  };

  const saveLocation = async () => {
    const account = accounts.find(item => item.name === accountName);
    const location = locations.find(item => item.name === locationName);
    if (!account || !location) {
      setError('Choose an account and a verified clinic location.');
      return;
    }
    setSavingLocation(true);
    setError('');
    setSuccess('');
    try {
      await api('/admin/google-reviews/location?department=dental', {
        method: 'POST',
        body: json({
          accountName: account.name,
          accountTitle: account.title,
          locationName: location.name,
          locationTitle: location.title
        })
      });
      await loadStatus();
      setSuccess('Google Business Profile location saved. You can now sync its reviews.');
      notify?.('Google Business Profile location saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingLocation(false);
    }
  };

  const syncReviews = async () => {
    setSyncing(true);
    setError('');
    setSuccess('');
    try {
      const result = await api('/admin/google-reviews/sync?department=dental', {
        method: 'POST',
        body: json({})
      });
      await loadStatus();
      setSuccess(`Sync complete: ${result.fetched} Google reviews fetched, ${result.imported} new and ${result.updated} updated. ${result.totalReviewCount} total reviews reported by Google.`);
      notify?.('Google reviews synchronised.');
    } catch (e) {
      setError(e.message);
      await loadStatus();
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect the Google Business Profile? Previously imported reviews will remain on the website, but automatic sync will stop.')) return;
    setError('');
    setSuccess('');
    try {
      await api('/admin/google-reviews/disconnect?department=dental', {
        method: 'POST',
        body: json({})
      });
      setAccounts([]);
      setLocations([]);
      await loadStatus();
      setSuccess('Google Business Profile disconnected. Previously imported reviews have been retained.');
    } catch (e) {
      setError(e.message);
    }
  };

  if (department === 'skin') {
    return <div className="google-reviews-admin"><div className="admin-panel google-reviews-admin-panel"><div className="google-reviews-admin-icon"><Star size={22}/></div><h2>Google Reviews are connected to Dental</h2><p>This Google Business Profile integration is intentionally scoped to the Dental department. Switch the admin department to Dental to manage its Google review connection.</p></div></div>;
  }

  if (loading) return <div className="admin-section-loading"><LoaderCircle className="spin" size={23}/><span>Checking Google Business Profile connection…</span></div>;

  return (
    <div className="google-reviews-admin">
      <div className="admin-page-intro">
        <div><span className="admin-eyebrow">DENTAL · REPUTATION</span><h2>Google Business Profile reviews</h2><p>Connect the clinic’s verified Google listing, import the complete review history and keep the website copy synchronised.</p></div>
        <span className={`google-reviews-connection-pill ${status?.connected ? 'connected' : ''}`}><span/>{status?.connected ? 'Google connected' : 'Not connected'}</span>
      </div>

      {error && <div className="inline-admin-error"><AlertCircle size={15}/>{error}</div>}
      {success && <div className="google-reviews-admin-success"><CheckCircle2 size={16}/>{success}</div>}

      <section className="admin-panel google-reviews-admin-panel">
        <div className="google-reviews-admin-panel-head">
          <div className="google-reviews-admin-icon"><Star size={22}/></div>
          <div><h3>Secure Google connection</h3><p>The dentist or an authorised Business Profile manager signs in with Google. The clinic password is never shared with this website.</p></div>
        </div>

        {!status?.configured && (
          <div className="google-reviews-admin-warning"><AlertCircle size={17}/><div><strong>Google OAuth credentials are not configured.</strong><p>Add the Google OAuth environment variables to Vercel before connecting. See <code>GOOGLE-REVIEWS-SETUP.md</code> in the patch files.</p></div></div>
        )}

        {!status?.connected ? (
          <div className="google-reviews-connect-row">
            <div><strong>Connect the clinic’s Google account</strong><small>Use the Google account that owns or manages the verified R Dental Business Profile.</small></div>
            <button className="admin-button primary" onClick={connect} disabled={!status?.configured}><Link2 size={16}/> Connect Google</button>
          </div>
        ) : (
          <>
            <div className="google-reviews-connected-summary">
              <div><span>CONNECTED ACCOUNT</span><strong>{status.accountTitle || status.connectedBy || 'Google Business account'}</strong></div>
              <div><span>SELECTED LOCATION</span><strong>{status.locationTitle || 'Choose a verified location below'}</strong></div>
              <div><span>LAST SYNC</span><strong>{formatDate(status.lastSyncedAt)}</strong></div>
            </div>

            <div className="google-reviews-location-picker">
              <div className="google-reviews-picker-head"><div><strong>Choose the correct Business Profile location</strong><small>Only reviews from the selected verified Dental location will be imported.</small></div><button type="button" className="admin-button secondary" onClick={loadAccounts} disabled={loadingAccounts}>{loadingAccounts ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>} Load accounts</button></div>
              {accounts.length > 0 && (
                <div className="google-reviews-picker-grid">
                  <label className="field"><span>Google account</span><select value={accountName} onChange={event => { setAccountName(event.target.value); setLocations([]); setLocationName(''); }}><option value="">Choose account</option>{accounts.map(account => <option key={account.name} value={account.name}>{account.title} · {account.name}</option>)}</select></label>
                  <div className="field"><span>Business locations</span><button type="button" className="admin-button secondary" onClick={loadLocations} disabled={!accountName || loadingLocations}>{loadingLocations ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>} Load locations</button></div>
                  {locations.length > 0 && <label className="field field-full"><span>Verified clinic location</span><select value={locationName} onChange={event => setLocationName(event.target.value)}><option value="">Choose location</option>{locations.map(location => <option key={location.name} value={location.name}>{location.title} · {location.name}</option>)}</select></label>}
                </div>
              )}
              {locations.length > 0 && <div className="google-reviews-picker-footer"><small>Choose the R Dental clinic listing that currently contains the 67–68 reviews. Do not select a similarly named listing for another branch.</small><button className="admin-button primary" onClick={saveLocation} disabled={savingLocation || !locationName}>{savingLocation ? <LoaderCircle className="spin" size={15}/> : <ShieldCheck size={15}/>} Save selected location</button></div>}
            </div>

            {status.locationName && (
              <div className="google-reviews-sync-row">
                <div><strong>{status.totalReviewCount || status.importedCount || 0} Google reviews in the selected profile</strong><small>{status.importedCount || 0} review records currently stored in this website’s MongoDB database{status.averageRating ? ` · ${Number(status.averageRating).toFixed(1)} average rating` : ''}.</small></div>
                <button className="admin-button primary" onClick={syncReviews} disabled={syncing}>{syncing ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>} Sync all Google reviews</button>
              </div>
            )}

            {status.lastSyncError && <div className="google-reviews-admin-warning"><AlertCircle size={17}/><div><strong>Last sync reported an issue.</strong><p>{status.lastSyncError}</p></div></div>}
            <div className="google-reviews-disconnect"><button className="admin-button secondary" onClick={disconnect}><Unlink size={15}/> Disconnect Google</button></div>
          </>
        )}
      </section>

      <section className="admin-panel google-reviews-admin-help">
        <h3>What happens after connection?</h3>
        <div className="google-reviews-help-grid">
          <div><b>01</b><strong>Historical import</strong><p>Sync fetches reviews in pages of up to 50 and imports the original text, reviewer display name, star rating, review date and clinic reply.</p></div>
          <div><b>02</b><strong>Safe storage</strong><p>Google review records are stored with a Google source ID. Re-sync updates the original record rather than creating duplicates.</p></div>
          <div><b>03</b><strong>Automatic refresh</strong><p>Vercel Cron checks the profile once daily by default. Google-sourced review content is cached for up to 28 days and refreshed on successful sync.</p></div>
        </div>
        <p className="google-reviews-admin-note"><ShieldCheck size={15}/> Imported Google reviews are read-only in this admin panel. You can hide a review from the website without changing or deleting it on Google.</p>
      </section>
    </div>
  );
}
