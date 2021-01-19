$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $favoritedArticles = $("#favorited-articles");
  const $createStoryForm = $("#create-story-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $userProfile = $("#user-profile");
  const $generalLoginAlert = $("#general-login-alert");
  const $loginAlert = $("#login-alert");
  const $signUpAlert = $("#signup-alert");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();
 

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    try {
      const userInstance = await User.login(username, password);
      // set the global user to the user instance
      currentUser = userInstance;
      markFavorites();
      fillProfile();
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
      $generalLoginAlert.hide();

    } catch (e) {
      console.log(e);
      $loginAlert.text("Error logging in. Check spelling and try again.").show();
      $("#login-password").val(""); 
    }
  });

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    try {
      // call the create method, which calls the API and then builds a new user instance
      const newUser = await User.create(username, password, name);
      currentUser = newUser;
      $generalLoginAlert.hide();
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
      fillProfile();
    } catch(e) {
      console.log(e);
      $signUpAlert.text("Error creating account. Try a different username or try again some other time").show();
      $("#create-account-password").val("");
      $("#create-account-username").val("");
    }
  });

  $createStoryForm.on("submit", async function(event) { // Part 2 of Assignment - Creating New Stories
    event.preventDefault();
    // check to see user is logged in

    //grab info from fields
    let author = $("#author").val();
    let title = $("#title").val();
    let url = $("#url").val();

    // create story object
    let storyObj = {};
    storyObj.author = author;
    storyObj.title = title;
    storyObj.url = url;

    resetFormAndHide($(this));
    
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    // Below will authenticate user so that only users can post.
    currentUser = await User.getLoggedInUser(token, username);

    // call addStory method using current user and story obj
    let response = await StoryList.addStory(currentUser, storyObj);
    // currentUser = await User.getLoggedInUser(token, username); // need to call again to have correct ownStories list   <--- this may not be needed if not showing trashcan on main page

    // refresh stories 
    await generateStories();
    markFavorites();
  });

  $("body").on("click", ".fave-icon", async function(event) {  // Part 3 of Assignment - Favoriting of Posts
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const storyID = event.target.parentElement.id;

    currentUser = await User.getLoggedInUser(token, username);
    if (!currentUser) {
      console.log("Favoriting requires user to be logged in");
      $("#general-login-alert").show();
      $loginForm.slideToggle();
      $createAccountForm.slideToggle();
      $allStoriesList.toggle();
      return;
    }
    
    const userFaves = currentUser.favorites.map(s => s.storyId);
    
    if (!userFaves.includes(storyID)) {
      console.log("story added to favorites")
      let response = await User.addFavorite(token, username, storyID); 
      currentUser = response.data.user; // update current user to properly mark most-current favorited articles
    } else {
      console.log("Story removed from favorites");
      let response = await User.deleteFavorite(token, username, storyID);
      currentUser = response.data.user;
    }
    
    markFavorites();
  });

  $("body").on("click", ".delete-icon", async function(event) { // Part 4 of Assignment - Removing Stories
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const storyID = event.target.parentElement.id;


    currentUser = await User.getLoggedInUser(token, username);
    
    let response = await User.deleteStory(token, storyID);
    console.log("Story deleted! :(")

    await generateStories();
    markFavorites();
  })

  $('#post-story').on("click", function() {
    $createStoryForm.slideToggle();
  })

  $("#favorites").on("click", async function(event) {
    // get User instance
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    currentUser = await User.getLoggedInUser(token, username);

    if (currentUser) {
      $allStoriesList.empty();
      $favoritedArticles.empty();
      $ownStories.empty();
      if (currentUser.favorites.length === 0) {
        $favoritedArticles.append("<li>You have not favorited any articles yet</li>");
        $favoritedArticles.show();

      } else {
        generateFaveStories();
        markFavorites();
        $favoritedArticles.show();
      }

    }
  });

  $("#my-stories").on("click", async function(event) {
    // get User instance
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    currentUser = await User.getLoggedInUser(token, username);

    if (currentUser) {
      $allStoriesList.empty();
      $favoritedArticles.empty();
      $ownStories.empty();
      if (currentUser.ownStories.length === 0) {
        $ownStories.append("<li>You have not submitted any articles yet</li>");
        $ownStories.show();
      } else {
        generateOwnStories();
        $ownStories.show();
        markFavorites();
        markOwnStories();
      }

    }
  })

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
    $generalLoginAlert.hide();
    $loginAlert.hide();
    $signUpAlert.hide();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await checkIfLoggedIn();
    $loginAlert.hide();
    $allStoriesList.show();
    $ownStories.empty();
    $generalLoginAlert.hide();
    $signUpAlert.hide();
  });

  // ============================================================================
  //  RUNS ON INITIAL PAGE LOAD 
  // ============================================================================

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();
    $userProfile.hide();

    if (currentUser) {
      showNavForLoggedInUser();
      markFavorites();
      fillProfile();
    }
  }
  // ============================================================================
  //  RESET OF FORMS TO BE CALLED UPON EVENT
  // ============================================================================

  /**
   * A rendering function to run to reset the forms and hide the login info
   */
  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();
    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");
    // show the stories
    $allStoriesList.show();
    // update the navigation bar
    showNavForLoggedInUser();
  }

  // general reset of any form;
  function resetFormAndHide(form) {
    form.trigger("reset");
    form.slideToggle();
  }  

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */
  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();
    $favoritedArticles.empty();
    $ownStories.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  // The following will render favorited stories 
  function generateFaveStories() { 
    if (!currentUser) {
      console.log('please log-in first');
      return;
    }
    const faveStoryObjs = currentUser.favorites;
    for (let story of faveStoryObjs) {
      let result = generateStoryHTML(story);
      $favoritedArticles.append(result);
    }

  }

  // The following will render stories User created
  function generateOwnStories() { 
    if (!currentUser) {
      console.log("please log in first");
      return;
    }
    const ownStoriesObjs = currentUser.ownStories;
    for (let story of ownStoriesObjs) {
      let result = generateStoryHTML(story);
      $ownStories.append(result);
    }
  }

  function fillProfile() {  
    if (!currentUser) {
      console.log("please log in first");
      return;
    }
    $userProfile.show();
    $("#profile-name").text(`Name: ${currentUser.name}`);
    $("#profile-username").text(`Username: ${currentUser.username}`);
    $("#profile-account-date").text(`Account Created: ${currentUser.createdAt.slice(0,10)}`);
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}"><i class="far fa-heart fave-icon"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  // check if Favorite and update HTML
  function markFavorites() {
    // requires currentUser;
    if (!currentUser) {
      console.log("Please log in!");
      return;
    }
    let favesList = currentUser.favorites.map( s => s.storyId );
    let $allFaveIcons = $('.fave-icon');
    $allFaveIcons.removeClass('fas').addClass('far');

    for (let faveStory of favesList) {
      const $targetLi = $(`#${faveStory} .fave-icon`); 
      $targetLi.removeClass('far').addClass('fas');
    } 
  }

  function markOwnStories() {
    if (!currentUser) {
      console.log("Please log in!");
      return;
    }
    let ownStoriesList = currentUser.ownStories.map( s => s.storyId );
    
    for (let ownStory of ownStoriesList) {
      let deleteIconHTML = '<i class="fas fa-trash-alt delete-icon"></i>'
      const $targetLi = $(`#${ownStory}`);
      $targetLi.prepend(deleteIconHTML);
    }
  }

  /* hide all elements in elementsArr */
  function hideElements() {
    const elementsArr = [
      $createStoryForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  /* hide/show appropriate nav links if user is logged in */
  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $("#post-story").show();
    $("#favorites").show();
    $("#my-stories").show();
    $("#nav-logout").text(`Logout @${localStorage.username}`)
  }

  /* simple function to pull the hostname from a URL */
  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */
  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});

