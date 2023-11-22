function updateLLPCount() {
    $.ajax({
        method: "get",
        url: "http://127.0.0.1:4000/llFormData", 
        success: function (data) {
            const llPendingsCount = data.length; 
            $("#LLPcount").text(llPendingsCount);
        },
        error: function () {
            $("#LLPcount").text("Error fetching data");
        }
    });
}

updateLLPCount();

function updateLLCCount() {
    $.ajax({
        method: "get",
        url: "http://127.0.0.1:4000/examStatus", 
        success: function (data) {
            const llPendingsCount = data.length; 
            $("#LLCcount").text(llPendingsCount);
        },
        error: function () {
            $("#LLCcount").text("Error fetching data");
        }
    });
}

updateLLCCount();

function updateDLPCount() {
    $.ajax({
        method: "get",
        url: "http://127.0.0.1:4000/DLSlotBookings", 
        success: function (data) {
            const llPendingsCount = data.length; 
            $("#DLPcount").text(llPendingsCount);
        },
        error: function () {
            $("#DLPcount").text("Error fetching data");
        }
    });
}

updateDLPCount();

function updateDLCCount() {
    $.ajax({
        method: "get",
        url: "http://127.0.0.1:4000/DLDetails", 
        success: function (data) {
            const llPendingsCount = data.length; 
            $("#DLCcount").text(llPendingsCount);
        },
        error: function () {
            $("#DLCcount").text("Error fetching data");
        }
    });
}

updateDLCCount();
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  function updateSlotCount() {
    const today = getTodayDate();
  
    $.ajax({
      method: "get",
      url: "http://127.0.0.1:4000/DLSlotBookings",
      success: function (data) {
        // Filter slot bookings to include only those with today's date
        const todayBookings = data.filter((booking) => booking.slotDate === today);
  
        // Get the count of matching bookings
        const count = todayBookings.length;
  
        // Update the count display
        $(".slotCount").text(count);
      },
      error: function () {
        alert("Error fetching slot booking data");
      },
    });
  }
  
    // Call the function to update the slot count for today's date
    updateSlotCount();

    

    

