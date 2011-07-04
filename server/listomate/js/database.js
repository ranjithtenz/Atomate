/**
 * Store items in SqlLite HTML5 Database
 * For storing notes/stuff locally!
 * 
 * @Author Wolfe Styke 
 * @Author Brennan Moore - modiefied this for Atomate adding person and location
 */

Atomate.database = {
    parent: Atomate,
    DB: null,
    initialize: function() {
        try {
            this.createPersonDB();
            this.createNoteDB();
            this.createLocationDB();
        } catch (e) {
            console.log(e);
        }
        
    },
    
    updateLocalNote: function(entity) {
        
    },

    updateLocalPerson: function(entity) {
        //
    },

    pushModified: function(lastPushed) {
        var this_ = this;
        var modified = lastPushed || 0;
        var people = this.parent.people.filter(function(d){ return d.modified >= modified; });
        var notes = this.parent.notes.filter(function(d){ return d.modified >= modified; });

        jQuery.postJSON('/data', {                            
                            people: people,
                            notes: notes
                        }, function(response) {
                            debug(response);
                        });
    },    

    pullModified: function(lastUpdated) {
        var this_ = this;
        var modified = lastUpdated || 0;
        jQuery.getJSON('/data', {
                           modified: modified
                       }, function(response) {
                           if (response.success && response.data) {                               
                               var people_cache = [];
                               var note_cache = [];

					           this_.parent.auth.interval_map_lite(response.data, 
                                                                   function(entry) { 
									                                   this_.updateLocalPerson(response, people_cache); 
						                                           }, function() { 
                                                                       console.log('about to save people from server');
                                                                       Atomate.database.person.putAllPeopleInDB(fb_people_cache);
                                                                       delete people_cache;
                                                                   });
                               
					           this_.parent.auth.interval_map_lite(response.data, 
                                                                   function(entry) { 
                                                                       this_.updateLocalNote(entry, note_cache); },                                                                               
                                                                   function() {
                                                                       console.log('about to save notes from server');                                                                     
                                                                       Atomate.database.notes.putAllNotesInDB(note_cache);
                                                                       delete note_cache;
                                                                   });
                           } else {
                               debug(response.code);
                           }
                       });
    },    

    
    clearDB: function(){
        this.clearNoteDB();        
        this.clearPersonDB();        
        this.clearLocationDB(); 
    },

    // TODO: fix repition of create statements
    clearNoteDB:function() {
        this._clearDB('note', 'CREATE TABLE note (' + this.notes.schema + ')');
    },
    
    createNoteDB:function() {
        this._createDB('CREATE TABLE IF NOT EXISTS note ('+ this.notes.schema + ')');
    },

    clearPersonDB:function() {
        this._clearDB('person', 'CREATE TABLE person (' + this.person.schema + ')');
    },

    createPersonDB:function() {
        this._createDB('CREATE TABLE IF NOT EXISTS person ('+ this.person.schema + ')');
    },

    clearLocationDB:function() {
        this._clearDB('location', 'CREATE TABLE location (' + this.location.schema + ')');
    },

    createLocationDB:function() {
        this._createDB('CREATE TABLE IF NOT EXISTS location ('+ this.location.schema + ')');
    },

    _clearDB: function(name,createSQL) {
	    this.DB.transaction(function(tx) {
	                            tx.executeSql('DROP TABLE ' + name, []);
	                            tx.executeSql(createSQL, []);
	                        });
    },

    _createDB:function(createSQL) {
	    // Open Database + Create Table if needed
        if (window.Components) {
            var this_ = this;
            this.setupFirefoxDB();
            this.isFirefox = true;
        }
	    this.DB = this.DB || openDatabase("Atomate","","Atomate", 5000000);
	    this.DB.transaction(function(tx) {	tx.executeSql(createSQL, []); });
    },

    _getUniqueID:function(name, continuation) {
        var this_ = this;
	    // Passes unique ID to continuation.
	    var id = Math.floor(Math.random()*1000000);
	    this.DB.transaction(function(tx) {
	                            tx.executeSql('SELECT * FROM ' + name +' WHERE id=? LIMIT 1',[id],
			                                  function(tx, rs) {
			                                      if (rs.rows.length === 1) {
				                                      // Chose existing id, repeat...
				                                      this_.getUniqueID(continuation);
			                                      } else { // No note
				                                      // Success - new id unique!
				                                      continuation(id);
			                                      }
			                                  },
			                                  function(tx, error) {
			                                      console.log("Unsuccessful get");
			                                      console.log(error);
			                                      continuation(id);
			                                  });
	                        });
    },
    setupFirefoxDB: function() {
        var this_ = this;

        netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect');
        var file = Components.classes["@mozilla.org/file/directory_service;1"]
            .getService(Components.interfaces.nsIProperties)
            .get("ProfD", Components.interfaces.nsIFile);
        file.append("Atomate_001.sqlite");

	    var storageService = Components.classes["@mozilla.org/storage/service;1"]
            .getService(Components.interfaces.mozIStorageService);
        this._DB = storageService.openDatabase(file); // cant be modified

        this.DB = {};
        this.DB.transaction = function(cont) { return cont(this_.DB); };
        this.DB.executeSql = function(stmnt, val, cont) { 
            if (val) { val.map(function(v){ 
                                   if (parseInt(v, 10)){
                                       stmnt = stmnt.replace('?', v);
                                   } else {
                                       stmnt = stmnt.replace('?', "\"" + v + "\"");
                                   }
                               });                                             
                     }
            if (!cont) { cont = function(){}; }

            netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect');
            var statement = this_._DB.createStatement(stmnt);
            var executedCont = false;
            return statement.executeAsync({
                                              handleResult: function(rs) {
                                                  var result = {rows:{item:[],length:0}};
                                                  var numRows = 0;
                                                  var row, i, k, v;
                                                  
                                                  netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect');                                                          
                                                  for (row = rs.getNextRow(); row; row = rs.getNextRow()) {
                                                      result.rows.item[numRows] = {};
                                                      for (i = 0; i < row.numEntries; i++) {
                                                          k = statement.getColumnName(i);
                                                          v = row.getResultByIndex(i);
                                                          result.rows.item[numRows][k] = v;
                                                      }
                                                      numRows++;
                                                      result.rows.length = numRows;
                                                  }
                                                  executedCont = true;
                                                  cont(statement, result);
                                              },                                                      
                                              handleError: function(e){ console.log(e + ' << error');  debug(e); },                                                      
                                              handleCompletion: function(e){  
                                                  if (e != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
                                                      debug("Query canceled or aborted!");
                                                  }                                                                                                    
                                                  if (!executedCont) {
                                                      cont(statement, {rows:{item:[],length:0}});
                                                  }
                                              }
                                          });
        };
    }
};      