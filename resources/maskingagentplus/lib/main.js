/*
 * Masking Agent+ changes platform details (OS and CPU), but leaves firefox version information intact.
 * (c) Copyright 2016 by Cosmostrix (lunakit.org)
 * (c) Copyright 2015 by Bas Alberts (basa.nl)
 */

const { Cc, Ci } = require("chrome");

var globalPrefs = require("sdk/preferences/service");
var simplePrefs = require("sdk/simple-prefs");

var MaskingAgentPlus = {
	name: 'Masking Agent+',
	data: [ 'oscpu', 'platform', 'appversion', 'useragent' ],
	owned: [ false, false, false, false ],
	log: function(s) {
		console.log('\t| ' + this.name + ': ' + s + '\n');
	},
	isActive: function() {
		return simplePrefs.prefs.active;
	},
	toggleActiveState: function() {
		if (this.isActive())
			this.deactivate();
		else
			this.activate();
	},
	modifyBrowser: function() {
		try {
			var httpInfo = Cc['@mozilla.org/network/protocol;1?name=http']
			               .getService(Ci.nsIHttpProtocolHandler);
			var os = simplePrefs.prefs.os;
			var osCpu = simplePrefs.prefs.oscpu;
			var platform = simplePrefs.prefs.platform;
			var userAgent = httpInfo.userAgent.replace(/\(.*; rv:/,
				              '(' + os + '; ' + osCpu + '; rv:');
			var values = [ httpInfo.appVersion + ' (' + os + ')',
			               osCpu, platform, userAgent ];

			// Override the global platform prefs, unless already overriden by others
			for (var i = 0; i < this.data.length; i++) {
				var pref = 'general.' + this.data[i] + '.override';
				this.owned[i] = this.owned[i] || !globalPrefs.isSet(pref);
				if (this.owned[i])
					globalPrefs.set(pref, values[i]);
			}
 		}
		catch (e) {
			this.log('Error modifying browser: ' + e);
			throw e;
		}
	},
	onPrefChange: function(prefName) {
		if (this.isActive())
			this.modifyBrowser();
	},
	activate: function() {
		simplePrefs.prefs.active = true;
		this.modifyBrowser();
		try {
			// Start listening to preference changes.
			simplePrefs.on('active',   this.onPrefChange);
			simplePrefs.on('os', 	   this.onPrefChange);
			simplePrefs.on('oscpu',    this.onPrefChange);
			simplePrefs.on('platform', this.onPrefChange);
 		} catch (e) {
			this.log('Error activating: ' + e);
			throw e;
		}
	},
	deactivate: function() {
		simplePrefs.prefs.active = false;
		try {
			// Restore the browser configuration.
			for (var i = 0; i < this.data.length; i++) {
				if (this.owned[i]) {
					var name = 'general.' + this.data[i] + '.override';
					globalPrefs.reset(name);
					this.owned[i] = false;
				}
			}
			// Stop listening to preference changes.
			simplePrefs.removeListener('active');
			simplePrefs.removeListener('os');
			simplePrefs.removeListener('oscpu');
			simplePrefs.removeListener('platform');
		} catch (e) {
			this.log('Error deactivating: ' + e);
			throw e;
		}
	},
	remove: function() {
		try {
			if (this.isActive())
				this.deactivate();
			// Delete the preferences branch created by Masking Agent+.
			simplePrefs.prefs.reset('active');
			simplePrefs.prefs.reset('os');
			simplePrefs.prefs.reset('oscpu');
			simplePrefs.prefs.reset('platform');
		}
		catch (e) {
			this.log('Error removing: ' + e);
			throw e;
		}
	}
};


/*
 * 	Masking Agent+ Toolbar Button
 */

var buttons = require('sdk/ui/button/action');

var MaskingAgentPlusTBButton = buttons.ActionButton({
	id: 'maskingAgentPlusToolbarButton',
	label: 'Switch Masking Agent+ On/Off',
	icon: './icon.png',
	onClick: function(state) {
		MaskingAgentPlus.toggleActiveState();
		MaskingAgentPlusTBButton.icon = simplePrefs.prefs.active ?
		  './icon.png' : './icoff.png';
	}
});


/*
 * 	Masking Agent+ load and unload.
 */

exports.main = function (options, callbacks) {
	// This add-on is loaded by Firefox.
	if (options.loadReason == 'install') {
		//MaskingAgentPlus.migrateOldPreferences();
	}
	MaskingAgentPlus.activate();
};

exports.onUnload = function (reason) {
	MaskingAgentPlus.deactivate();
	if (reason == 'uninstall') {
		MaskingAgentPlus.remove();
	}
};

