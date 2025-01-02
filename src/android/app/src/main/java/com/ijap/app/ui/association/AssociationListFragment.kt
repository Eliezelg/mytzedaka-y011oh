package com.ijap.app.ui.association

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.paging.LoadState
import androidx.paging.PagingDataAdapter
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.bumptech.glide.Glide // v4.16.0
import com.google.firebase.analytics.FirebaseAnalytics // v21.5.0
import com.ijap.app.R
import com.ijap.app.data.models.Association
import com.ijap.app.databinding.FragmentAssociationListBinding
import com.ijap.app.util.NetworkStateMonitor
import com.ijap.app.util.SearchDebouncer
import com.ijap.app.util.analytics.AnalyticsTracker
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import timber.log.Timber // v5.0.1
import javax.inject.Inject

/**
 * Fragment displaying a paginated, searchable list of Jewish charitable associations.
 * Implements offline support, RTL layout capabilities, and efficient resource management.
 */
@AndroidEntryPoint
class AssociationListFragment : Fragment() {

    private var _binding: FragmentAssociationListBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AssociationViewModel by viewModels()
    
    @Inject
    lateinit var analyticsTracker: AnalyticsTracker
    
    @Inject
    lateinit var networkMonitor: NetworkStateMonitor

    private val searchDebouncer = SearchDebouncer(lifecycleScope)

    private val associationAdapter by lazy {
        AssociationListAdapter(
            glide = Glide.with(this),
            onAssociationClicked = { association ->
                analyticsTracker.logEvent(FirebaseAnalytics.Event.SELECT_ITEM) {
                    param(FirebaseAnalytics.Param.ITEM_ID, association.id)
                    param(FirebaseAnalytics.Param.ITEM_NAME, association.name)
                }
                viewModel.selectAssociation(association)
            }
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAssociationListBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
        observeViewModel()
        setupNetworkMonitoring()
    }

    private fun setupUI() {
        setupRecyclerView()
        setupSwipeRefresh()
        setupSearch()
        setupErrorHandling()
    }

    private fun setupRecyclerView() {
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = associationAdapter
            setHasFixedSize(true)
            
            // RTL support
            layoutDirection = if (resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL) {
                View.LAYOUT_DIRECTION_RTL
            } else {
                View.LAYOUT_DIRECTION_LTR
            }
        }

        // Load state handling
        associationAdapter.addLoadStateListener { loadState ->
            binding.apply {
                progressBar.isVisible = loadState.source.refresh is LoadState.Loading
                recyclerView.isVisible = loadState.source.refresh is LoadState.NotLoading
                errorLayout.root.isVisible = loadState.source.refresh is LoadState.Error
                
                // Empty state handling
                emptyView.isVisible = loadState.source.refresh is LoadState.NotLoading &&
                    associationAdapter.itemCount == 0
            }
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.apply {
            setOnRefreshListener {
                viewModel.refreshData()
                analyticsTracker.logEvent("association_list_refreshed")
            }
            setColorSchemeResources(R.color.primary)
        }
    }

    private fun setupSearch() {
        binding.searchView.apply {
            setOnQueryTextListener(object : androidx.appcompat.widget.SearchView.OnQueryTextListener {
                override fun onQueryTextSubmit(query: String?): Boolean {
                    query?.let {
                        analyticsTracker.logEvent("association_search") {
                            param("query", it)
                        }
                        viewModel.searchAssociations(it)
                    }
                    return true
                }

                override fun onQueryTextChange(newText: String?): Boolean {
                    newText?.let {
                        searchDebouncer.debounce(300L) {
                            viewModel.searchAssociations(it)
                        }
                    }
                    return true
                }
            })
        }
    }

    private fun setupErrorHandling() {
        binding.errorLayout.retryButton.setOnClickListener {
            associationAdapter.retry()
            analyticsTracker.logEvent("association_list_retry")
        }
    }

    private fun setupNetworkMonitoring() {
        viewLifecycleOwner.lifecycleScope.launch {
            networkMonitor.isNetworkAvailable
                .distinctUntilChanged()
                .collect { isAvailable ->
                    binding.offlineBar.isVisible = !isAvailable
                    if (!isAvailable) {
                        analyticsTracker.logEvent("offline_mode_entered")
                    }
                }
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is UiState.Loading -> showLoading()
                    is UiState.Success -> hideLoading()
                    is UiState.Error -> showError(state.message)
                    else -> Unit
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.associations.collectLatest { pagingData ->
                associationAdapter.submitData(pagingData)
            }
        }
    }

    private fun showLoading() {
        binding.swipeRefresh.isRefreshing = true
    }

    private fun hideLoading() {
        binding.swipeRefresh.isRefreshing = false
    }

    private fun showError(message: String) {
        binding.swipeRefresh.isRefreshing = false
        binding.errorLayout.errorMessage.text = message
        binding.errorLayout.root.isVisible = true
        Timber.e("Error loading associations: $message")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        fun newInstance() = AssociationListFragment()
    }
}

/**
 * RecyclerView adapter for paginated association list with efficient item diffing.
 */
private class AssociationListAdapter(
    private val glide: RequestManager,
    private val onAssociationClicked: (Association) -> Unit
) : PagingDataAdapter<Association, AssociationViewHolder>(ASSOCIATION_COMPARATOR) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AssociationViewHolder {
        val binding = ItemAssociationBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return AssociationViewHolder(binding, glide, onAssociationClicked)
    }

    override fun onBindViewHolder(holder: AssociationViewHolder, position: Int) {
        getItem(position)?.let { association ->
            holder.bind(association)
        }
    }

    companion object {
        private val ASSOCIATION_COMPARATOR = object : DiffUtil.ItemCallback<Association>() {
            override fun areItemsTheSame(oldItem: Association, newItem: Association): Boolean {
                return oldItem.id == newItem.id
            }

            override fun areContentsTheSame(oldItem: Association, newItem: Association): Boolean {
                return oldItem == newItem
            }
        }
    }
}

/**
 * ViewHolder for association items with efficient view recycling.
 */
private class AssociationViewHolder(
    private val binding: ItemAssociationBinding,
    private val glide: RequestManager,
    private val onAssociationClicked: (Association) -> Unit
) : RecyclerView.ViewHolder(binding.root) {

    fun bind(association: Association) {
        binding.apply {
            root.setOnClickListener { onAssociationClicked(association) }
            
            associationName.text = association.name
            associationDescription.text = association.description
            
            // RTL support for text
            associationName.textDirection = if (association.isRtl) {
                View.TEXT_DIRECTION_RTL
            } else {
                View.TEXT_DIRECTION_LTR
            }
            
            // Load and cache logo
            glide.load(association.logoUrl)
                .placeholder(R.drawable.placeholder_association)
                .error(R.drawable.error_association)
                .circleCrop()
                .into(associationLogo)
                
            // Verified badge
            verifiedBadge.isVisible = association.isVerified
        }
    }
}