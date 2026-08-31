const state = {
  users: [],
  widgets: [],
  submissions: []
  };
  
  function reset() {
  state.users.length = 0;
  state.widgets.length = 0;
  state.submissions.length = 0;
  }
  
  module.exports = {
  state,
  reset
  };
  